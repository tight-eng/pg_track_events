import { eq } from "drizzle-orm";
import { tenantsTable } from "./schema/core";
import { DB } from ".";

export async function getTenantById(db: DB, tenantId: string) {
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1)
  return tenant
}
