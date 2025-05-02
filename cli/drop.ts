import { SQL } from "bun";
import kleur from "kleur";
import ora from "ora";

export async function dropTight(sql: SQL) {
  try {
    const spinner = ora(
      "Dropping schema_pg_track_events database components..."
    ).start();

    await sql`
          DO $$
          BEGIN
            -- Revoke public schema permissions
            REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM schema_pg_track_events_agent;
            REVOKE ALL PRIVILEGES ON SCHEMA public FROM schema_pg_track_events_agent;
            
            -- Revoke schema_pg_track_events schema permissions
            REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA schema_pg_track_events FROM schema_pg_track_events_agent;
            REVOKE ALL PRIVILEGES ON SCHEMA schema_pg_track_events FROM schema_pg_track_events_agent;
            
            -- Drop the role
            DROP ROLE IF EXISTS schema_pg_track_events_agent;
          EXCEPTION
            WHEN OTHERS THEN
              RAISE NOTICE 'Error dropping schema_pg_track_events_agent role: %', SQLERRM;
          END $$;
        `;

    await sql`DROP SCHEMA schema_pg_track_events CASCADE`;

    spinner.succeed(
      kleur.green(
        "Successfully removed all schema_pg_track_events components from your database"
      )
    );
  } catch (error) {
    console.error(
      kleur.red("\nFailed to drop schema_pg_track_events components:")
    );
    console.error(
      kleur.dim(error instanceof Error ? error.message : String(error))
    );
    process.exit(1);
  }
}
