import { expect, test } from "bun:test";
import { extractColumnsFromFunction } from "../sql_functions/log-changes-builder";

test("can extract current columns from function body", () => {
  const columns = extractColumnsFromFunction(example);
  expect(columns).toEqual(
    new Set([
      "affiliation",
      "average_lifespan",
      "force_sensitive",
      "homeworld",
      "notable_character",
      "species_name",
    ])
  );
});

test("can extract single columns from function body", () => {
  const columns = extractColumnsFromFunction(exampleOneCol);
  expect(columns).toEqual(new Set(["id"]));
});

const example = `$$ LANGUAGE plpgsql; CREATE OR REPLACE FUNCTION tight_analytics.log_alien_types_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
                    SELECT (affiliation, average_lifespan, force_sensitive, homeworld, notable_character, species_name) FROM NEW
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
                    SELECT (affiliation, average_lifespan, force_sensitive, homeworld, notable_character, species_name) FROM OLD
                ) t),
                (SELECT row_to_json(t) FROM (
                    SELECT (affiliation, average_lifespan, force_sensitive, homeworld, notable_character, species_name) FROM NEW
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
                    SELECT (affiliation, average_lifespan, force_sensitive, homeworld, notable_character, species_name) FROM OLD
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
$function$`;

const exampleOneCol = `$$ LANGUAGE plpgsql; CREATE OR REPLACE FUNCTION tight_analytics.log_alien_types_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
                    SELECT (id) FROM NEW
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
                    SELECT (id) FROM OLD
                ) t),
                (SELECT row_to_json(t) FROM (
                    SELECT (id) FROM NEW
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
                    SELECT (id) FROM OLD
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
$function$`;
