import { SQL } from "bun";
import ora from "ora";
import kleur from "kleur";

export async function createAgentUser(sql: SQL, databaseUrl: string) {
  console.log("\n" + "Creating schema_pg_track_events_agent role:");
  const spinnerRole = ora(
    `Creating schema_pg_track_events_agent role`
  ).start();
  try {
    const password = Buffer.from(crypto.getRandomValues(new Uint8Array(32)))
      .toString("base64")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 32);

    await sql.unsafe(`
      DO $$
      DECLARE
          password text := '${password}';
      BEGIN
         -- Create the role if it doesn't already exist, or alter it if it does
         IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'schema_pg_track_events_agent') THEN
            EXECUTE 'CREATE ROLE schema_pg_track_events_agent LOGIN PASSWORD ' || quote_literal(password);
         ELSE
            EXECUTE 'ALTER ROLE schema_pg_track_events_agent WITH PASSWORD ' || quote_literal(password);
         END IF;
         -- Grant permissions to the user
         EXECUTE 'GRANT CONNECT ON DATABASE ' || current_database() || ' TO schema_pg_track_events_agent';
         -- Public schema permissions
         GRANT USAGE ON SCHEMA public TO schema_pg_track_events_agent;
         GRANT SELECT ON ALL TABLES IN SCHEMA public TO schema_pg_track_events_agent;
         ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO schema_pg_track_events_agent;
         GRANT TRIGGER ON ALL TABLES IN SCHEMA public TO schema_pg_track_events_agent;
         ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRIGGER ON TABLES TO schema_pg_track_events_agent;
         -- schema_pg_track_events schema permissions
         GRANT USAGE ON SCHEMA schema_pg_track_events TO schema_pg_track_events_agent;
         GRANT SELECT, INSERT ON schema_pg_track_events.event_log TO schema_pg_track_events_agent;
         ALTER DEFAULT PRIVILEGES IN SCHEMA schema_pg_track_events GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO schema_pg_track_events_agent;
      END $$;
    `);
    spinnerRole.succeed(
      `Created a limited access schema_pg_track_events_agent role with a random password`
    );
    console.log(
      "\n" +
        kleur
          .yellow()
          .bold(
            "IMPORTANT: Provide this connection string in the enviroment when you deploy your analytics agent. "
          )
    );

    // Extract the host part from the database URL (everything after the @ symbol)
    const databaseHost = databaseUrl.includes("@")
      ? databaseUrl.split("@")[1]
      : databaseUrl;
    // Construct the connection string with the extracted host
    const connectionString = `postgresql://schema_pg_track_events_agent:${password}@${databaseHost}`;
    console.log(kleur.dim(connectionString) + "\n");
    return;
  } catch (error: any) {
    spinnerRole.fail(
      kleur
        .red()
        .bold(
          `Failed to create schema_pg_track_events_agent role: ${error.message}`
        )
    );
    console.error(kleur.red(error));
  }
}
