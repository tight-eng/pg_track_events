import { z } from 'zod';
import { baseProcedure, createTRPCRouter } from '../init';

import { crmDomainHandlers } from './crm-domain-handlers';
import { tenantsRouter } from './tenants';
import { reportsRouter } from './reports';
import { slackRouter } from './slack';

export const appRouter = createTRPCRouter({
  hello: baseProcedure
    .input(
      z.object({
        text: z.string(),
      }),
    )
    .query((opts) => {
      return {
        greeting: `hello ${opts.input.text}`,
      };
    }),

  tenants: tenantsRouter,
  domainHandlers: crmDomainHandlers,
  reports: reportsRouter,
  slack: slackRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;