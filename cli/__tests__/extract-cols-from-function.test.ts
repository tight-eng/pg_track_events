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
      "id",
      "notable_character",
      "species_name",
    ])
  );
});

test("can extract single columns from function body", () => {
  const columns = extractColumnsFromFunction(exampleOneCol);
  expect(columns).toEqual(new Set(["affiliation"]));
});

const example = `CREATE OR REPLACE FUNCTION tight_analytics.log_alien_types_changes()
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
            json_build_object('affiliation', NEW.affiliation, 'average_lifespan', NEW.average_lifespan, 'force_sensitive', NEW.force_sensitive, 'homeworld', NEW.homeworld, 'id', NEW.id, 'notable_character', NEW.notable_character, 'species_name', NEW.species_name)
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
            json_build_object('affiliation', OLD.affiliation, 'average_lifespan', OLD.average_lifespan, 'force_sensitive', OLD.force_sensitive, 'homeworld', OLD.homeworld, 'id', OLD.id, 'notable_character', OLD.notable_character, 'species_name', OLD.species_name),
            json_build_object('affiliation', NEW.affiliation, 'average_lifespan', NEW.average_lifespan, 'force_sensitive', NEW.force_sensitive, 'homeworld', NEW.homeworld, 'id', NEW.id, 'notable_character', NEW.notable_character, 'species_name', NEW.species_name)
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
            json_build_object('affiliation', OLD.affiliation, 'average_lifespan', OLD.average_lifespan, 'force_sensitive', OLD.force_sensitive, 'homeworld', OLD.homeworld, 'id', OLD.id, 'notable_character', OLD.notable_character, 'species_name', OLD.species_name),
            NULL
        );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;`;

const exampleOneCol = `CREATE OR REPLACE FUNCTION tight_analytics.log_alien_types_changes()
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
            json_build_object('affiliation', NEW.affiliation)
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
            json_build_object('affiliation', OLD.affiliation)
            json_build_object('affiliation', NEW.affiliation)
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
            json_build_object('affiliation', OLD.affiliation)
            NULL
        );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;`;
