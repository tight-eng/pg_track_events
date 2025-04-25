import { z } from 'zod';
import { baseProcedure, createTRPCRouter } from '../init';
import { TightCommandsSchema, TightLogEvent } from '@/types/crm';
import { inngest } from '@/inngest/client';
import { createTestBus } from '@/domains/__tests__/test-bus';
import { DealModelDomain } from '@/domains/deal-model';
import { composeCommandBus } from '@/domains/bus';
import { TRPCError } from '@trpc/server';
import { AccountDomain } from '@/domains/accounts';
import { DealsDomain } from '@/domains/deals';
import { db, eventBatchEventsTable, eventBatchTable, eventLogTable, slackMessagesTable } from '@/db';
import { eq, and, not, isNotNull, desc, asc } from 'drizzle-orm';
import { stringifyEvents } from '@/domains/to-english';

export const crmDomainHandlers = createTRPCRouter({
  getDealTypesForTenant: baseProcedure
    .input(z.object({
      tenantId: z.string(),
    }))
    .query(async (opts) => {
      const dealModelDomain = DealModelDomain.new(opts.input.tenantId);
      return dealModelDomain.queries.getDealTypes();
    }),
  getAccountsForTenant: baseProcedure
    .input(z.object({
      tenantId: z.string(),
    }))
    .query(async (opts) => {
      const dealModelDomain = AccountDomain.new(opts.input.tenantId);
      return dealModelDomain.queries.getAllAccounts();
    }),

  getDealsForTenant: baseProcedure
    .input(z.object({
      tenantId: z.string(),
    }))
    .query(async (opts) => {
      const dealModelDomain = DealsDomain.new(opts.input.tenantId);
      return dealModelDomain.queries.getDeals();
    }),


  getEventBatchesForTenant: baseProcedure
    .input(z.object({
      tenantId: z.string(),
    }))
    .query(async (opts) => {
      const batches = await db
        .select({
          batch: eventBatchTable,
          events: eventLogTable,
          slackMessage: slackMessagesTable
        })
        .from(eventBatchTable)
        .orderBy(
          desc(eventBatchTable.id),
        )
        .where(
          and(
            eq(eventBatchTable.tenantId, opts.input.tenantId),
            isNotNull(eventBatchTable.slackMessageId)
          )
        )
        .leftJoin(eventBatchEventsTable, eq(eventBatchEventsTable.batchId, eventBatchTable.id))
        .leftJoin(eventLogTable, eq(eventLogTable.id, eventBatchEventsTable.eventId))
        .leftJoin(slackMessagesTable, and(
          eq(slackMessagesTable.id, eventBatchTable.slackMessageId),
          isNotNull(eventBatchTable.slackMessageId)
        ))


      // Group events by batch
      const batchesWithEvents: Record<number, any> = {};

      for (const row of batches) {
        const batchId = row.batch.id;
        if (!batchesWithEvents[batchId]) {
          batchesWithEvents[batchId] = {
            ...row.batch,
            slackMessage: row.slackMessage,
            events: []
          };
        }
        if (row.events) {
          const stringifiedEvents = await stringifyEvents([row.events.data], opts.input.tenantId);
          batchesWithEvents[batchId].events.push(...stringifiedEvents);
        }
      }

      //@todo change this. it's hacky and won't work once we have more batches / paginate 
      return Object.values(batchesWithEvents).reverse();
    }),

  dispatchCommand: baseProcedure
    .input(z.object({
      command: TightCommandsSchema,
      // @todo not auth friendly
      tenantId: z.string(),
    }))
    .mutation(async (opts) => {

      const dealModelDomain = DealModelDomain.new(opts.input.tenantId);
      const accountsDomain = AccountDomain.new(opts.input.tenantId);
      const dealsDomain = DealsDomain.new(opts.input.tenantId);

      const bus = composeCommandBus(dealModelDomain, accountsDomain, dealsDomain);
      const result = await bus(opts.input.command);

      if (result.events) {
        console.log("Events:", result.events);
        await inngest.send({
          name: "domains/internal/apply-events",
          data: {
            tenantId: opts.input.tenantId,
            events: result.events
          },
        });
        return {
          accepted: true,
        };
      } else if (result.error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error,
        });
      }
    })
});