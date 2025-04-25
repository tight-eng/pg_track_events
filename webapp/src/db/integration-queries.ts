import { connectionsTable, connectionUsersTable, connectionAuthStatesTable, connectionEventsTable } from "@/db/schema/core"
import { eq, and, sql } from "drizzle-orm"
import { DB } from "."
import { ProviderKind, ConnectionEventKind, ConnectionAuthStateKind } from "@/types/integrations"

export async function getConnectionById(db: DB, connectionId: string) {
  const [connection] = await db.select().from(connectionsTable).where(eq(connectionsTable.id, connectionId)).limit(1)
  return connection
}

export async function getConnectionByProviderConnectionId(db: DB, provider: ProviderKind, providerConnectionId: string) {
  const [connection] = await db.select().from(connectionsTable).where(and(eq(connectionsTable.provider, provider), eq(connectionsTable.providerConnectionId, providerConnectionId))).limit(1)
  return connection
}

export async function deleteConnectionByProviderConnectionId(db: DB, provider: ProviderKind, providerConnectionId: string) {
  await db.delete(connectionsTable).where(and(eq(connectionsTable.provider, provider), eq(connectionsTable.providerConnectionId, providerConnectionId)))
}

export async function deleteConnection(db: DB, connectionId: string) {
  await db.delete(connectionsTable).where(eq(connectionsTable.id, connectionId))
}

export async function upsertConnection(db: DB, { provider, providerConnectionId, providerData, tenantId }: { provider: ProviderKind, providerConnectionId: string, providerData: any, tenantId: string }) {
  const [connection] = await db.insert(connectionsTable)
    .values({ provider, providerConnectionId, providerData, tenantId })
    .onConflictDoUpdate({
      target: [connectionsTable.provider, connectionsTable.providerConnectionId],
      set: { providerData }
    })
    .returning()
  return connection
}

export async function updateConnectionName(db: DB, connectionId: string, name: string) {
  await db.update(connectionsTable).set({ name }).where(eq(connectionsTable.id, connectionId))
}

export async function upsertConnectionUser(db: DB, {
  connectionId,
  name,
  providerUserId,
  providerUserEmail,
  providerUserName,
  providerUserAvatarUrl,
  providerUserConversationId,
  providerData,
  userId
}: {
  connectionId: string
  providerUserId: string
  name: string
  userId: string
  providerUserEmail?: string
  providerUserName?: string
  providerUserAvatarUrl?: string
  providerUserConversationId?: string
  providerData: any
}) {
  const [connectionUser] = await db
    .insert(connectionUsersTable)
    .values({
      connectionId,
      name,
      userId,
      providerUserId,
      providerUserEmail,
      providerUserName,
      providerUserAvatarUrl,
      providerUserConversationId,
      providerData,
    })
    .onConflictDoUpdate({
      target: [connectionUsersTable.connectionId, connectionUsersTable.providerUserId],
      set: { providerData, providerUserEmail, providerUserName, providerUserAvatarUrl, providerUserConversationId, name }
    })
    .returning()
  return connectionUser
}

export async function updateConnectionUserConversationId(db: DB, connectionUserId: string, providerUserConversationId: string) {
  await db.update(connectionUsersTable).set({ providerUserConversationId }).where(eq(connectionUsersTable.id, connectionUserId))
}

export async function updateConnectionUserName(db: DB, connectionUserId: string, name: string) {
  await db.update(connectionUsersTable).set({ name }).where(eq(connectionUsersTable.id, connectionUserId))
}

export async function getConnectionUserById(db: DB, connectionUserId: string) {
  const [connectionUser] = await db
    .select()
    .from(connectionUsersTable)
    .where(eq(connectionUsersTable.id, connectionUserId))
    .limit(1)
  return connectionUser
}

export async function getConnectionUserByProviderUserId(db: DB, connectionId: string, providerUserId: string) {
  const [connectionUser] = await db
    .select()
    .from(connectionUsersTable)
    .where(
      and(
        eq(connectionUsersTable.connectionId, connectionId),
        eq(connectionUsersTable.providerUserId, providerUserId)
      )
    )
    .limit(1)
  return connectionUser
}

export async function getConnectionUsers(db: DB, connectionId: string, limit: number = 100, offset: number = 0) {
  const users = await db
    .select()
    .from(connectionUsersTable)
    .where(eq(connectionUsersTable.connectionId, connectionId))
    .limit(limit)
    .offset(offset)
  return users
}

export async function deleteConnectionUser(db: DB, connectionUserId: string) {
  await db
    .delete(connectionUsersTable)
    .where(eq(connectionUsersTable.id, connectionUserId))
}

export async function deleteConnectionUserByProviderUserId(db: DB, connectionId: string, providerUserId: string) {
  await db
    .delete(connectionUsersTable)
    .where(
      and(
        eq(connectionUsersTable.connectionId, connectionId),
        eq(connectionUsersTable.providerUserId, providerUserId)
      )
    )
}

export async function insertConnectionAuthState(db: DB, {
  userId,
  state,
  kind,
  data,
  expiresAt,
  connectionId,
  connectionUserId
}: {
  userId: string,
  connectionId?: string,
  connectionUserId?: string,
  kind: ConnectionAuthStateKind,
  state: string,
  data: any,
  expiresAt: Date
}) {
  const [connectionAuthState] = await db.insert(connectionAuthStatesTable)
    .values({ userId, connectionId, connectionUserId, kind, state, data, expiresAt })
    .returning()
  return connectionAuthState
}

export async function getConnectionAuthByStateString(db: DB, state: string, kind: ConnectionAuthStateKind) {
  const [connectionAuthState] = await db.select().from(connectionAuthStatesTable)
    .where(and(eq(connectionAuthStatesTable.state, state), eq(connectionAuthStatesTable.kind, kind)))
    .limit(1)
  return connectionAuthState
}

export async function updateConnectionAuthStateUsedAt(db: DB, id: string, usedAt: Date) {
  await db.update(connectionAuthStatesTable).set({ usedAt }).where(eq(connectionAuthStatesTable.id, id))
}

export async function updateConnectionAuthStateData(db: DB, id: string, data: any) {
  await db.update(connectionAuthStatesTable).set({ data }).where(eq(connectionAuthStatesTable.id, id))
}

export async function insertConnectionEvent(db: DB, {
  connectionId,
  kind,
  data
}: {
  connectionId: string,
  kind: ConnectionEventKind,
  data: any
}) {
  const [connectionEvent] = await db.insert(connectionEventsTable).values({ connectionId, kind, data }).returning()
  return connectionEvent
}