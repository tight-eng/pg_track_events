export function tableNameToAuditFunctionName(tableName: string) {
  return `tight_analytics.log_${tableName}_changes`;
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
        INSERT INTO tight_analytics.event_log (
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
        INSERT INTO tight_analytics.event_log (
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
        INSERT INTO tight_analytics.event_log (
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
  // This regex looks for column names in a SELECT clause
  // It handles various formats including:
  // - Simple columns: SELECT col1, col2 FROM...
  // - Parenthesized columns: SELECT (col1, col2, col3) FROM...
  // - Columns with whitespace: SELECT col1 , col2 FROM...
  const regex = /SELECT\s+(?:\(([^)]+)\)|([^()]+?)(?=\s+FROM|\s*\)))/i;

  const columnSet = new Set<string>();
  const match = regex.exec(query);

  if (match) {
    // Get the matched group (either parenthesized or non-parenthesized)
    const columnsStr = match[1] || match[2];

    if (columnsStr) {
      // Split by commas and clean up each column name
      columnsStr
        .split(",")
        .map((col) => col.trim())
        .filter((col) => col && !col.toLowerCase().startsWith("from"))
        .forEach((col) => columnSet.add(col));
    }
  }

  return columnSet;
}
