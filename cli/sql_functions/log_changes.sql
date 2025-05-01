-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION tight_analytics.log_table_changes()
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
            to_jsonb(NEW)
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
            to_jsonb(OLD),
            to_jsonb(NEW)
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
            to_jsonb(OLD),
            NULL
        );
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;