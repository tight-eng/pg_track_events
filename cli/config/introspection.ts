import { SQL } from "bun";

export async function getIntrospectedSchema(sql: SQL) {
  const result = await sql.file("../agent/introspect_pg.sql");
  return JSON.parse(result[0].schema_json);
}
