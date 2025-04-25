import { usersTable } from "@/db/schema/core"
import { eq } from "drizzle-orm"
import { DB } from "."

export async function getUserById(db: DB, id: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1)
  return user
}

