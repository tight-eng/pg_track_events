-- Description: + tight_analytics schema
CREATE SCHEMA tight_analytics

CREATE TYPE tight_analytics.event_type AS ENUM ('insert', 'update', 'delete')

-- Description: + event_log table in tight_analytics schema
CREATE TABLE tight_analytics.event_log (
    id BIGSERIAL PRIMARY KEY,
    event_type tight_analytics.event_type NOT NULL,
    row_table_name TEXT NOT NULL,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
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

-- Description: + tight_analytics.log_alien_types_changes function for alien_types table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION tight_analytics.log_alien_types_changes()
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
                    SELECT (affiliation, average_lifespan, force_sensitive, homeworld, id, notable_character, species_name) FROM NEW
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
                    SELECT (affiliation, average_lifespan, force_sensitive, homeworld, id, notable_character, species_name) FROM OLD
                ) t),
                (SELECT row_to_json(t) FROM (
                    SELECT (affiliation, average_lifespan, force_sensitive, homeworld, id, notable_character, species_name) FROM NEW
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
                    SELECT (affiliation, average_lifespan, force_sensitive, homeworld, id, notable_character, species_name) FROM OLD
                ) t),
                NULL
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
    
        NULL;
    END;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Description: + alien_types_audit_trigger trigger on alien_types table
CREATE TRIGGER alien_types_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.alien_types
    FOR EACH ROW
    EXECUTE FUNCTION tight_analytics.log_alien_types_changes();

-- Description: + tight_analytics.log_analytic_event_changes function for analytic_event table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION tight_analytics.log_analytic_event_changes()
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
                    SELECT (created_at, id, name, properties, updated_at) FROM NEW
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
                    SELECT (created_at, id, name, properties, updated_at) FROM OLD
                ) t),
                (SELECT row_to_json(t) FROM (
                    SELECT (created_at, id, name, properties, updated_at) FROM NEW
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
                    SELECT (created_at, id, name, properties, updated_at) FROM OLD
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
$$ LANGUAGE plpgsql;

-- Description: + analytic_event_audit_trigger trigger on analytic_event table
CREATE TRIGGER analytic_event_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.analytic_event
    FOR EACH ROW
    EXECUTE FUNCTION tight_analytics.log_analytic_event_changes();

-- Description: + tight_analytics.log_app_user_changes function for app_user table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION tight_analytics.log_app_user_changes()
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
                    SELECT (created_at, email, email_verified, hashed_password, id, image, name, updated_at) FROM NEW
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
                    SELECT (created_at, email, email_verified, hashed_password, id, image, name, updated_at) FROM OLD
                ) t),
                (SELECT row_to_json(t) FROM (
                    SELECT (created_at, email, email_verified, hashed_password, id, image, name, updated_at) FROM NEW
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
                    SELECT (created_at, email, email_verified, hashed_password, id, image, name, updated_at) FROM OLD
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
$$ LANGUAGE plpgsql;

-- Description: + app_user_audit_trigger trigger on app_user table
CREATE TRIGGER app_user_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.app_user
    FOR EACH ROW
    EXECUTE FUNCTION tight_analytics.log_app_user_changes();

-- Description: + tight_analytics.log_dance_like_everyone_watching_changes function for dance_like_everyone_watching table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION tight_analytics.log_dance_like_everyone_watching_changes()
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
$$ LANGUAGE plpgsql;

-- Description: + dance_like_everyone_watching_audit_trigger trigger on dance_like_everyone_watching table
CREATE TRIGGER dance_like_everyone_watching_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.dance_like_everyone_watching
    FOR EACH ROW
    EXECUTE FUNCTION tight_analytics.log_dance_like_everyone_watching_changes();

-- Description: + tight_analytics.log_invite_changes function for invite table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION tight_analytics.log_invite_changes()
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
                    SELECT (created_at, email, expired, id, invited_by, message, organization_id, status, updated_at) FROM NEW
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
                    SELECT (created_at, email, expired, id, invited_by, message, organization_id, status, updated_at) FROM OLD
                ) t),
                (SELECT row_to_json(t) FROM (
                    SELECT (created_at, email, expired, id, invited_by, message, organization_id, status, updated_at) FROM NEW
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
                    SELECT (created_at, email, expired, id, invited_by, message, organization_id, status, updated_at) FROM OLD
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
$$ LANGUAGE plpgsql;

-- Description: + invite_audit_trigger trigger on invite table
CREATE TRIGGER invite_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.invite
    FOR EACH ROW
    EXECUTE FUNCTION tight_analytics.log_invite_changes();

-- Description: + tight_analytics.log_jedis_changes function for jedis table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION tight_analytics.log_jedis_changes()
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
$$ LANGUAGE plpgsql;

-- Description: + jedis_audit_trigger trigger on jedis table
CREATE TRIGGER jedis_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.jedis
    FOR EACH ROW
    EXECUTE FUNCTION tight_analytics.log_jedis_changes();

-- Description: + tight_analytics.log_membership_changes function for membership table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION tight_analytics.log_membership_changes()
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
                    SELECT (created_at, id, organization_id, role, updated_at, user_id) FROM NEW
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
                    SELECT (created_at, id, organization_id, role, updated_at, user_id) FROM OLD
                ) t),
                (SELECT row_to_json(t) FROM (
                    SELECT (created_at, id, organization_id, role, updated_at, user_id) FROM NEW
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
                    SELECT (created_at, id, organization_id, role, updated_at, user_id) FROM OLD
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
$$ LANGUAGE plpgsql;

-- Description: + membership_audit_trigger trigger on membership table
CREATE TRIGGER membership_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.membership
    FOR EACH ROW
    EXECUTE FUNCTION tight_analytics.log_membership_changes();

-- Description: + tight_analytics.log_newtable_fun_time_changes function for newtable_fun_time table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION tight_analytics.log_newtable_fun_time_changes()
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
$$ LANGUAGE plpgsql;

-- Description: + newtable_fun_time_audit_trigger trigger on newtable_fun_time table
CREATE TRIGGER newtable_fun_time_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.newtable_fun_time
    FOR EACH ROW
    EXECUTE FUNCTION tight_analytics.log_newtable_fun_time_changes();

-- Description: + tight_analytics.log_organization_changes function for organization table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION tight_analytics.log_organization_changes()
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
                    SELECT (created_at, id, name, updated_at) FROM NEW
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
                    SELECT (created_at, id, name, updated_at) FROM OLD
                ) t),
                (SELECT row_to_json(t) FROM (
                    SELECT (created_at, id, name, updated_at) FROM NEW
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
                    SELECT (created_at, id, name, updated_at) FROM OLD
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
$$ LANGUAGE plpgsql;

-- Description: + organization_audit_trigger trigger on organization table
CREATE TRIGGER organization_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.organization
    FOR EACH ROW
    EXECUTE FUNCTION tight_analytics.log_organization_changes();

-- Description: + tight_analytics.log_remember_alamo_changes function for remember_alamo table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION tight_analytics.log_remember_alamo_changes()
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
$$ LANGUAGE plpgsql;

-- Description: + remember_alamo_audit_trigger trigger on remember_alamo table
CREATE TRIGGER remember_alamo_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.remember_alamo
    FOR EACH ROW
    EXECUTE FUNCTION tight_analytics.log_remember_alamo_changes();

-- Description: + tight_analytics.log_swim_changes function for swim table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION tight_analytics.log_swim_changes()
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
$$ LANGUAGE plpgsql;

-- Description: + swim_audit_trigger trigger on swim table
CREATE TRIGGER swim_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.swim
    FOR EACH ROW
    EXECUTE FUNCTION tight_analytics.log_swim_changes();

-- Description: + tight_analytics schema
CREATE SCHEMA tight_analytics

CREATE TYPE tight_analytics.event_type AS ENUM ('insert', 'update', 'delete')

-- Description: + event_log table in tight_analytics schema
CREATE TABLE tight_analytics.event_log (
    id BIGSERIAL PRIMARY KEY,
    event_type tight_analytics.event_type NOT NULL,
    row_table_name TEXT NOT NULL,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
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

-- Description: + tight_analytics.log_alien_types_changes function for alien_types table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION tight_analytics.log_alien_types_changes()
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
                (SELECT row_to_json(t) FROM (SELECT (affiliation, average_lifespan, force_sensitive, homeworld, id, notable_character, species_name) FROM (SELECT NEW.*) t) t)
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
                (SELECT row_to_json(t) FROM (SELECT (affiliation, average_lifespan, force_sensitive, homeworld, id, notable_character, species_name) FROM (SELECT OLD.*) t) t),
                (SELECT row_to_json(t) FROM (SELECT (affiliation, average_lifespan, force_sensitive, homeworld, id, notable_character, species_name) FROM (SELECT NEW.*) t) t)
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
                (SELECT row_to_json(t) FROM (SELECT (affiliation, average_lifespan, force_sensitive, homeworld, id, notable_character, species_name) FROM (SELECT OLD.*) t) t),
                NULL
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- If logging fails, just skip it and continue with the main operation
        NULL;
    END;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Description: + alien_types_audit_trigger trigger on alien_types table
CREATE OR REPLACE TRIGGER alien_types_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.alien_types
    FOR EACH ROW
    EXECUTE FUNCTION tight_analytics.log_alien_types_changes();

-- Description: + tight_analytics.log_analytic_event_changes function for analytic_event table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION tight_analytics.log_analytic_event_changes()
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
                (SELECT row_to_json(t) FROM (SELECT (created_at, id, name, properties, updated_at) FROM (SELECT NEW.*) t) t)
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
                (SELECT row_to_json(t) FROM (SELECT (created_at, id, name, properties, updated_at) FROM (SELECT OLD.*) t) t),
                (SELECT row_to_json(t) FROM (SELECT (created_at, id, name, properties, updated_at) FROM (SELECT NEW.*) t) t)
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
                (SELECT row_to_json(t) FROM (SELECT (created_at, id, name, properties, updated_at) FROM (SELECT OLD.*) t) t),
                NULL
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- If logging fails, just skip it and continue with the main operation
        NULL;
    END;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Description: + analytic_event_audit_trigger trigger on analytic_event table
CREATE OR REPLACE TRIGGER analytic_event_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.analytic_event
    FOR EACH ROW
    EXECUTE FUNCTION tight_analytics.log_analytic_event_changes();

-- Description: + tight_analytics.log_app_user_changes function for app_user table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION tight_analytics.log_app_user_changes()
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
                (SELECT row_to_json(t) FROM (SELECT (created_at, email, email_verified, hashed_password, id, image, name, updated_at) FROM (SELECT NEW.*) t) t)
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
                (SELECT row_to_json(t) FROM (SELECT (created_at, email, email_verified, hashed_password, id, image, name, updated_at) FROM (SELECT OLD.*) t) t),
                (SELECT row_to_json(t) FROM (SELECT (created_at, email, email_verified, hashed_password, id, image, name, updated_at) FROM (SELECT NEW.*) t) t)
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
                (SELECT row_to_json(t) FROM (SELECT (created_at, email, email_verified, hashed_password, id, image, name, updated_at) FROM (SELECT OLD.*) t) t),
                NULL
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- If logging fails, just skip it and continue with the main operation
        NULL;
    END;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Description: + app_user_audit_trigger trigger on app_user table
CREATE OR REPLACE TRIGGER app_user_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.app_user
    FOR EACH ROW
    EXECUTE FUNCTION tight_analytics.log_app_user_changes();

-- Description: + tight_analytics.log_dance_like_everyone_watching_changes function for dance_like_everyone_watching table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION tight_analytics.log_dance_like_everyone_watching_changes()
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
                (SELECT row_to_json(t) FROM (SELECT (id) FROM (SELECT NEW.*) t) t)
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
                (SELECT row_to_json(t) FROM (SELECT (id) FROM (SELECT OLD.*) t) t),
                (SELECT row_to_json(t) FROM (SELECT (id) FROM (SELECT NEW.*) t) t)
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
                (SELECT row_to_json(t) FROM (SELECT (id) FROM (SELECT OLD.*) t) t),
                NULL
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- If logging fails, just skip it and continue with the main operation
        NULL;
    END;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Description: + dance_like_everyone_watching_audit_trigger trigger on dance_like_everyone_watching table
CREATE OR REPLACE TRIGGER dance_like_everyone_watching_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.dance_like_everyone_watching
    FOR EACH ROW
    EXECUTE FUNCTION tight_analytics.log_dance_like_everyone_watching_changes();

-- Description: + tight_analytics.log_invite_changes function for invite table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION tight_analytics.log_invite_changes()
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
                (SELECT row_to_json(t) FROM (SELECT (created_at, email, expired, id, invited_by, message, organization_id, status, updated_at) FROM (SELECT NEW.*) t) t)
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
                (SELECT row_to_json(t) FROM (SELECT (created_at, email, expired, id, invited_by, message, organization_id, status, updated_at) FROM (SELECT OLD.*) t) t),
                (SELECT row_to_json(t) FROM (SELECT (created_at, email, expired, id, invited_by, message, organization_id, status, updated_at) FROM (SELECT NEW.*) t) t)
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
                (SELECT row_to_json(t) FROM (SELECT (created_at, email, expired, id, invited_by, message, organization_id, status, updated_at) FROM (SELECT OLD.*) t) t),
                NULL
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- If logging fails, just skip it and continue with the main operation
        NULL;
    END;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Description: + invite_audit_trigger trigger on invite table
CREATE OR REPLACE TRIGGER invite_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.invite
    FOR EACH ROW
    EXECUTE FUNCTION tight_analytics.log_invite_changes();

-- Description: + tight_analytics.log_jedis_changes function for jedis table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION tight_analytics.log_jedis_changes()
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
                (SELECT row_to_json(t) FROM (SELECT (id) FROM (SELECT NEW.*) t) t)
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
                (SELECT row_to_json(t) FROM (SELECT (id) FROM (SELECT OLD.*) t) t),
                (SELECT row_to_json(t) FROM (SELECT (id) FROM (SELECT NEW.*) t) t)
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
                (SELECT row_to_json(t) FROM (SELECT (id) FROM (SELECT OLD.*) t) t),
                NULL
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- If logging fails, just skip it and continue with the main operation
        NULL;
    END;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Description: + jedis_audit_trigger trigger on jedis table
CREATE OR REPLACE TRIGGER jedis_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.jedis
    FOR EACH ROW
    EXECUTE FUNCTION tight_analytics.log_jedis_changes();

-- Description: + tight_analytics.log_membership_changes function for membership table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION tight_analytics.log_membership_changes()
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
                (SELECT row_to_json(t) FROM (SELECT (created_at, id, organization_id, role, updated_at, user_id) FROM (SELECT NEW.*) t) t)
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
                (SELECT row_to_json(t) FROM (SELECT (created_at, id, organization_id, role, updated_at, user_id) FROM (SELECT OLD.*) t) t),
                (SELECT row_to_json(t) FROM (SELECT (created_at, id, organization_id, role, updated_at, user_id) FROM (SELECT NEW.*) t) t)
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
                (SELECT row_to_json(t) FROM (SELECT (created_at, id, organization_id, role, updated_at, user_id) FROM (SELECT OLD.*) t) t),
                NULL
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- If logging fails, just skip it and continue with the main operation
        NULL;
    END;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Description: + membership_audit_trigger trigger on membership table
CREATE OR REPLACE TRIGGER membership_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.membership
    FOR EACH ROW
    EXECUTE FUNCTION tight_analytics.log_membership_changes();

-- Description: + tight_analytics.log_newtable_fun_time_changes function for newtable_fun_time table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION tight_analytics.log_newtable_fun_time_changes()
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
                (SELECT row_to_json(t) FROM (SELECT (id) FROM (SELECT NEW.*) t) t)
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
                (SELECT row_to_json(t) FROM (SELECT (id) FROM (SELECT OLD.*) t) t),
                (SELECT row_to_json(t) FROM (SELECT (id) FROM (SELECT NEW.*) t) t)
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
                (SELECT row_to_json(t) FROM (SELECT (id) FROM (SELECT OLD.*) t) t),
                NULL
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- If logging fails, just skip it and continue with the main operation
        NULL;
    END;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Description: + newtable_fun_time_audit_trigger trigger on newtable_fun_time table
CREATE OR REPLACE TRIGGER newtable_fun_time_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.newtable_fun_time
    FOR EACH ROW
    EXECUTE FUNCTION tight_analytics.log_newtable_fun_time_changes();

-- Description: + tight_analytics.log_organization_changes function for organization table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION tight_analytics.log_organization_changes()
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
                (SELECT row_to_json(t) FROM (SELECT (created_at, id, name, updated_at) FROM (SELECT NEW.*) t) t)
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
                (SELECT row_to_json(t) FROM (SELECT (created_at, id, name, updated_at) FROM (SELECT OLD.*) t) t),
                (SELECT row_to_json(t) FROM (SELECT (created_at, id, name, updated_at) FROM (SELECT NEW.*) t) t)
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
                (SELECT row_to_json(t) FROM (SELECT (created_at, id, name, updated_at) FROM (SELECT OLD.*) t) t),
                NULL
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- If logging fails, just skip it and continue with the main operation
        NULL;
    END;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Description: + organization_audit_trigger trigger on organization table
CREATE OR REPLACE TRIGGER organization_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.organization
    FOR EACH ROW
    EXECUTE FUNCTION tight_analytics.log_organization_changes();

-- Description: + tight_analytics.log_remember_alamo_changes function for remember_alamo table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION tight_analytics.log_remember_alamo_changes()
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
                (SELECT row_to_json(t) FROM (SELECT (id) FROM (SELECT NEW.*) t) t)
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
                (SELECT row_to_json(t) FROM (SELECT (id) FROM (SELECT OLD.*) t) t),
                (SELECT row_to_json(t) FROM (SELECT (id) FROM (SELECT NEW.*) t) t)
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
                (SELECT row_to_json(t) FROM (SELECT (id) FROM (SELECT OLD.*) t) t),
                NULL
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- If logging fails, just skip it and continue with the main operation
        NULL;
    END;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Description: + remember_alamo_audit_trigger trigger on remember_alamo table
CREATE OR REPLACE TRIGGER remember_alamo_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.remember_alamo
    FOR EACH ROW
    EXECUTE FUNCTION tight_analytics.log_remember_alamo_changes();

-- Description: + tight_analytics.log_swim_changes function for swim table trigger
-- Generic trigger function for insert, update, and delete
CREATE OR REPLACE FUNCTION tight_analytics.log_swim_changes()
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
                (SELECT row_to_json(t) FROM (SELECT (id) FROM (SELECT NEW.*) t) t)
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
                (SELECT row_to_json(t) FROM (SELECT (id) FROM (SELECT OLD.*) t) t),
                (SELECT row_to_json(t) FROM (SELECT (id) FROM (SELECT NEW.*) t) t)
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
                (SELECT row_to_json(t) FROM (SELECT (id) FROM (SELECT OLD.*) t) t),
                NULL
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- If logging fails, just skip it and continue with the main operation
        NULL;
    END;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Description: + swim_audit_trigger trigger on swim table
CREATE OR REPLACE TRIGGER swim_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.swim
    FOR EACH ROW
    EXECUTE FUNCTION tight_analytics.log_swim_changes();