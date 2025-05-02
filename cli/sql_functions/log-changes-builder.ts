export function tableNameToAuditFunctionName(tableName: string) {
  return `scheme_for_pg_track_events.log_${tableName}_changes`;
}

export function logChangesBuilder(
  tableName: string,
  includedColumns: string[]
) {
  const functionName = tableNameToAuditFunctionName(tableName);

  // Create json_build_object string for columns
  const jsonBuildObject = (prefix: "NEW" | "OLD") =>
    `json_build_object(${includedColumns
      .sort()
      .map((col) => `'${col}', ${prefix}.${col}`)
      .join(", ")})`;

  const functionBody = `-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION ${functionName}()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO scheme_for_pg_track_events.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'insert',
            TG_TABLE_NAME,
            NULL,
            ${jsonBuildObject("NEW")}
        );
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO scheme_for_pg_track_events.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'update',
            TG_TABLE_NAME,
            ${jsonBuildObject("OLD")},
            ${jsonBuildObject("NEW")}
        );
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO scheme_for_pg_track_events.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'delete',
            TG_TABLE_NAME,
            ${jsonBuildObject("OLD")},
            NULL
        );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;`;

  return [functionName, functionBody];
}

export function extractColumnsFromFunction(query: string): Set<string> {
  // This regex looks for column names in a json_build_object format
  // It matches patterns like: 'column_name', NEW.column_name
  const regex = /'([^']+)',\s*(?:NEW|OLD)\.\1/g;

  const columnSet = new Set<string>();
  let match;

  while ((match = regex.exec(query)) !== null) {
    // The first capture group contains the column name
    columnSet.add(match[1]);
  }

  return columnSet;
}
