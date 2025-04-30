import { SQL } from "bun";

type Column = {
  name: string;
  type: string;
  default: string | null;
  attributes: { autoIncrement?: boolean } | null;
  constraints: { notNull?: boolean } | null;
};

type Index = {
  name: string;
  type: string;
  columns: string[];
  isUnique: boolean;
};

type Trigger = {
  name: string;
  events: string[];
  arguments: string[];
  condition: string | null;
  forEachRow: boolean;
  executeProcedure: string;
  forEachStatement: boolean;
  constraintTrigger: boolean;
};

type ForeignKey = {
  name: string;
  columns: string[];
  onDelete: string;
  references: {
    table: string;
    columns: string[];
  };
};

type Table = {
  name: string;
  columns: Column[];
  indexes: Index[] | null;
  triggers: Trigger[] | null;
  isDeleted: boolean;
  primaryKey: string[];
  foreignKeys: ForeignKey[] | null;
};

export type DatabaseSchema = Table[];

export async function getIntrospectedSchema(sql: SQL): Promise<DatabaseSchema> {
  const result = await sql.file("../agent/introspect_pg.sql");
  return JSON.parse(result[0].schema_json);
}

export function allowedTableNames(schema: DatabaseSchema) {
  const allNames = schema.map((table) => table.name);

  return new Set([
    ...allNames,
    ...allNames
      .filter((i) => i.startsWith("public."))
      .map((i) => i.split(".")[1]),
  ]);
}
