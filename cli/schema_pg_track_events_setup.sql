-- Description: + schema_pg_track_events schema
CREATE SCHEMA schema_pg_track_events

CREATE TYPE schema_pg_track_events.event_type AS ENUM ('insert', 'update', 'delete')

-- Description: + event_log table in schema_pg_track_events schema
CREATE TABLE schema_pg_track_events.event_log (
    id BIGSERIAL PRIMARY KEY,
    event_type schema_pg_track_events.event_type NOT NULL,
    row_table_name TEXT NOT NULL,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    retries INT NOT NULL DEFAULT 0,
    last_error TEXT,
    last_retry_at TIMESTAMPTZ,
    process_after TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    old_row JSONB,
    new_row JSONB,
    CONSTRAINT event_type_update_check CHECK (
      (event_type = 'update' AND old_row IS NOT NULL AND new_row IS NOT NULL) OR
      (event_type != 'update')
    ),
    CONSTRAINT event_type_insert_check CHECK (
      (event_type = 'insert' AND old_row IS NULL AND new_row IS NOT NULL) OR 
      (event_type != 'insert')
    ),
    CONSTRAINT event_type_delete_check CHECK (
      (event_type = 'delete' AND old_row IS NOT NULL AND new_row IS NULL) OR
      (event_type != 'delete')
    )
  )

-- Description: + event_log_process_after_idx index
CREATE INDEX CONCURRENTLY IF NOT EXISTS event_log_process_after_idx
    ON schema_pg_track_events.event_log (process_after)

-- Description: + schema_pg_track_events.log_alien_types_changes function for alien_types table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION schema_pg_track_events.log_alien_types_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO schema_pg_track_events.event_log (
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
        INSERT INTO schema_pg_track_events.event_log (
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
        INSERT INTO schema_pg_track_events.event_log (
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
$$ LANGUAGE plpgsql;

-- Description: + alien_types_audit_trigger trigger on alien_types table
CREATE OR REPLACE TRIGGER alien_types_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.alien_types
    FOR EACH ROW
    EXECUTE FUNCTION schema_pg_track_events.log_alien_types_changes();

-- Description: + schema_pg_track_events.log_app_user_changes function for app_user table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION schema_pg_track_events.log_app_user_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO schema_pg_track_events.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'insert',
            TG_TABLE_NAME,
            NULL,
            json_build_object('created_at', NEW.created_at, 'email', NEW.email, 'email_verified', NEW.email_verified, 'hashed_password', NEW.hashed_password, 'id', NEW.id, 'image', NEW.image, 'name', NEW.name, 'updated_at', NEW.updated_at)
        );
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO schema_pg_track_events.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'update',
            TG_TABLE_NAME,
            json_build_object('created_at', OLD.created_at, 'email', OLD.email, 'email_verified', OLD.email_verified, 'hashed_password', OLD.hashed_password, 'id', OLD.id, 'image', OLD.image, 'name', OLD.name, 'updated_at', OLD.updated_at),
            json_build_object('created_at', NEW.created_at, 'email', NEW.email, 'email_verified', NEW.email_verified, 'hashed_password', NEW.hashed_password, 'id', NEW.id, 'image', NEW.image, 'name', NEW.name, 'updated_at', NEW.updated_at)
        );
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO schema_pg_track_events.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'delete',
            TG_TABLE_NAME,
            json_build_object('created_at', OLD.created_at, 'email', OLD.email, 'email_verified', OLD.email_verified, 'hashed_password', OLD.hashed_password, 'id', OLD.id, 'image', OLD.image, 'name', OLD.name, 'updated_at', OLD.updated_at),
            NULL
        );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Description: + app_user_audit_trigger trigger on app_user table
CREATE OR REPLACE TRIGGER app_user_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.app_user
    FOR EACH ROW
    EXECUTE FUNCTION schema_pg_track_events.log_app_user_changes();

-- Description: + schema_pg_track_events.log_dance_like_everyone_watching_changes function for dance_like_everyone_watching table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION schema_pg_track_events.log_dance_like_everyone_watching_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO schema_pg_track_events.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'insert',
            TG_TABLE_NAME,
            NULL,
            json_build_object('id', NEW.id)
        );
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO schema_pg_track_events.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'update',
            TG_TABLE_NAME,
            json_build_object('id', OLD.id),
            json_build_object('id', NEW.id)
        );
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO schema_pg_track_events.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'delete',
            TG_TABLE_NAME,
            json_build_object('id', OLD.id),
            NULL
        );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Description: + dance_like_everyone_watching_audit_trigger trigger on dance_like_everyone_watching table
CREATE OR REPLACE TRIGGER dance_like_everyone_watching_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.dance_like_everyone_watching
    FOR EACH ROW
    EXECUTE FUNCTION schema_pg_track_events.log_dance_like_everyone_watching_changes();

-- Description: + schema_pg_track_events.log_invite_changes function for invite table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION schema_pg_track_events.log_invite_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO schema_pg_track_events.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'insert',
            TG_TABLE_NAME,
            NULL,
            json_build_object('created_at', NEW.created_at, 'email', NEW.email, 'expired', NEW.expired, 'id', NEW.id, 'invited_by', NEW.invited_by, 'message', NEW.message, 'organization_id', NEW.organization_id, 'status', NEW.status, 'updated_at', NEW.updated_at)
        );
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO schema_pg_track_events.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'update',
            TG_TABLE_NAME,
            json_build_object('created_at', OLD.created_at, 'email', OLD.email, 'expired', OLD.expired, 'id', OLD.id, 'invited_by', OLD.invited_by, 'message', OLD.message, 'organization_id', OLD.organization_id, 'status', OLD.status, 'updated_at', OLD.updated_at),
            json_build_object('created_at', NEW.created_at, 'email', NEW.email, 'expired', NEW.expired, 'id', NEW.id, 'invited_by', NEW.invited_by, 'message', NEW.message, 'organization_id', NEW.organization_id, 'status', NEW.status, 'updated_at', NEW.updated_at)
        );
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO schema_pg_track_events.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'delete',
            TG_TABLE_NAME,
            json_build_object('created_at', OLD.created_at, 'email', OLD.email, 'expired', OLD.expired, 'id', OLD.id, 'invited_by', OLD.invited_by, 'message', OLD.message, 'organization_id', OLD.organization_id, 'status', OLD.status, 'updated_at', OLD.updated_at),
            NULL
        );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Description: + invite_audit_trigger trigger on invite table
CREATE OR REPLACE TRIGGER invite_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.invite
    FOR EACH ROW
    EXECUTE FUNCTION schema_pg_track_events.log_invite_changes();

-- Description: + schema_pg_track_events.log_membership_changes function for membership table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION schema_pg_track_events.log_membership_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO schema_pg_track_events.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'insert',
            TG_TABLE_NAME,
            NULL,
            json_build_object('created_at', NEW.created_at, 'id', NEW.id, 'organization_id', NEW.organization_id, 'role', NEW.role, 'updated_at', NEW.updated_at, 'user_id', NEW.user_id)
        );
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO schema_pg_track_events.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'update',
            TG_TABLE_NAME,
            json_build_object('created_at', OLD.created_at, 'id', OLD.id, 'organization_id', OLD.organization_id, 'role', OLD.role, 'updated_at', OLD.updated_at, 'user_id', OLD.user_id),
            json_build_object('created_at', NEW.created_at, 'id', NEW.id, 'organization_id', NEW.organization_id, 'role', NEW.role, 'updated_at', NEW.updated_at, 'user_id', NEW.user_id)
        );
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO schema_pg_track_events.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'delete',
            TG_TABLE_NAME,
            json_build_object('created_at', OLD.created_at, 'id', OLD.id, 'organization_id', OLD.organization_id, 'role', OLD.role, 'updated_at', OLD.updated_at, 'user_id', OLD.user_id),
            NULL
        );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Description: + membership_audit_trigger trigger on membership table
CREATE OR REPLACE TRIGGER membership_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.membership
    FOR EACH ROW
    EXECUTE FUNCTION schema_pg_track_events.log_membership_changes();

-- Description: + schema_pg_track_events.log_organization_changes function for organization table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION schema_pg_track_events.log_organization_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO schema_pg_track_events.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'insert',
            TG_TABLE_NAME,
            NULL,
            json_build_object('created_at', NEW.created_at, 'id', NEW.id, 'name', NEW.name, 'updated_at', NEW.updated_at)
        );
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO schema_pg_track_events.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'update',
            TG_TABLE_NAME,
            json_build_object('created_at', OLD.created_at, 'id', OLD.id, 'name', OLD.name, 'updated_at', OLD.updated_at),
            json_build_object('created_at', NEW.created_at, 'id', NEW.id, 'name', NEW.name, 'updated_at', NEW.updated_at)
        );
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO schema_pg_track_events.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'delete',
            TG_TABLE_NAME,
            json_build_object('created_at', OLD.created_at, 'id', OLD.id, 'name', OLD.name, 'updated_at', OLD.updated_at),
            NULL
        );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Description: + organization_audit_trigger trigger on organization table
CREATE OR REPLACE TRIGGER organization_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.organization
    FOR EACH ROW
    EXECUTE FUNCTION schema_pg_track_events.log_organization_changes();

-- Description: + schema_pg_track_events.log_remember_alamo_changes function for remember_alamo table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION schema_pg_track_events.log_remember_alamo_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO schema_pg_track_events.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'insert',
            TG_TABLE_NAME,
            NULL,
            json_build_object('id', NEW.id)
        );
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO schema_pg_track_events.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'update',
            TG_TABLE_NAME,
            json_build_object('id', OLD.id),
            json_build_object('id', NEW.id)
        );
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO schema_pg_track_events.event_log (
            event_type,
            row_table_name,
            old_row,
            new_row
        ) VALUES (
            'delete',
            TG_TABLE_NAME,
            json_build_object('id', OLD.id),
            NULL
        );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Description: + remember_alamo_audit_trigger trigger on remember_alamo table
CREATE OR REPLACE TRIGGER remember_alamo_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.remember_alamo
    FOR EACH ROW
    EXECUTE FUNCTION schema_pg_track_events.log_remember_alamo_changes();