export function tableNameToAuditFunctionName(tableName: string) {
  return `tight_analytics.log_${tableName}_changes`;
}

export function logChangesBuilder(
  tableName: string,
  excludedColumns: string[]
) {
  const exceptClause =
    excludedColumns.length > 0 ? `EXCEPT (${excludedColumns.join(", ")})` : "";

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
                    SELECT NEW.* ${exceptClause}
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
                    SELECT OLD.* ${exceptClause}
                ) t),
                (SELECT row_to_json(t) FROM (
                    SELECT NEW.* ${exceptClause}
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
                    SELECT OLD.* ${exceptClause}
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

export function extractExcludedColumns(selectStatement: string): Set<string> {
  const regex = /SELECT OLD\.\*\s*(?:EXCEPT\s*\(([^)]+)\))?/;
  const match = selectStatement.match(regex);

  if (!match || !match[1]) {
    return new Set();
  }

  // Split on commas, trim whitespace, and filter out empty strings
  return new Set(
    match[1]
      .split(",")
      .map((col) => col.trim())
      .filter((col) => col.length > 0)
  );
}
