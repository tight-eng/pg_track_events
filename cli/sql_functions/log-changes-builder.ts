export function tableNameToAuditFunctionName(tableName: string) {
  return `tight_analytics.log_${tableName}_changes`;
}

export function logChangesBuilder(
  tableName: string,
  includedColumns: string[]
) {
  const columnsClause =
    includedColumns.length > 0 ? `(${includedColumns.sort().join(", ")})` : "*";

  const functionName = tableNameToAuditFunctionName(tableName);
  const functionBody = `-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION ${functionName}()
RETURNS TRIGGER AS $$
BEGIN
    -- Wrap the logging in a separate transaction with error handling
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
                (SELECT row_to_json(t) FROM (
                    SELECT ${columnsClause} FROM NEW
                ) t)
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
                (SELECT row_to_json(t) FROM (
                    SELECT ${columnsClause} FROM OLD
                ) t),
                (SELECT row_to_json(t) FROM (
                    SELECT ${columnsClause} FROM NEW
                ) t)
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
                (SELECT row_to_json(t) FROM (
                    SELECT ${columnsClause} FROM OLD
                ) t),
                NULL
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- If logging fails, just skip it and continue with the main operation
        NULL;
    END;
    
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
