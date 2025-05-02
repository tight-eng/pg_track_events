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
    ...allNames
      .filter((i) => i.startsWith("public."))
      .map((i) => i.split(".")[1]),
  ]);
}

export function applyIgnoresToSchema(
  schema: DatabaseSchema,
  ignoreConfig: Record<string, "*" | string[]>
): DatabaseSchema {
  if (!ignoreConfig || Object.keys(ignoreConfig).length === 0) {
    return schema;
  }

  return schema.filter((table) => {
    // Extract table name without schema prefix if present
    const tableName = table.name.startsWith("public.")
      ? table.name.split(".")[1]
      : table.name;

    // Skip tables that are fully ignored
    if (ignoreConfig[tableName] === "*") {
      return false;
    }

    // Process tables with specific column ignores
    if (ignoreConfig[tableName] && Array.isArray(ignoreConfig[tableName])) {
      // Filter out ignored columns
      table.columns = table.columns.filter(
        (column) => !ignoreConfig[tableName].includes(column.name)
      );
    }

    return true;
  });
}
export function getTableNames(schema: DatabaseSchema): string[] {
  return schema
    .filter((table) => table.name.startsWith("public."))
    .map((table) => table.name.split(".")[1]);
}

export function getColumnsForTable(
  schema: DatabaseSchema,
  tableName: string
): Set<string> {
  // Normalize the table name to handle both with and without schema prefix
  const normalizedTableName = tableName.startsWith("public.")
    ? tableName
    : `public.${tableName}`;

  // Find the table in the schema
  const table = schema.find(
    (t) => t.name === normalizedTableName || t.name === tableName
  );

  if (!table) {
    return new Set<string>();
  }
  return new Set(table.columns.map((column) => column.name));
}
