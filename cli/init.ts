import { SQL } from "bun";
import ora from "ora";
import crypto from "crypto";

//constants
const schemaName: string = "tight_analytics" as const;

export async function init(
  databaseUrl: string,
  reset: boolean = false,
  dryRun: boolean = false
) {
  const spinner = ora("Connecting to database...").start();

  const sql = new SQL(databaseUrl);

  spinner.succeed("Connected to database");
  console.log();

  // Check if schema exists
  const schemaExists = !!(
    await sql`
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name = 'tight_analytics'
  `
  )[0];

  if (schemaExists) {
    if (reset) {
      console.log("Dropping tight_analytics scheme to reset instance...");
      await sql`DROP SCHEMA tight_analytics CASCADE`;
    } else {
      console.log("Already initialized. Exiting... Run with --reset to reset.");
      await sql.close();
      return;
    }
  }

  const spinnerScheme = ora(
    "Setting up analytics scheme and functions..."
  ).start();

  await sql`CREATE SCHEMA ${sql(schemaName)}`;
  // Create the update enum type first
  await sql`CREATE TYPE ${sql(
    schemaName
  )}.event_type AS ENUM ('insert', 'update', 'delete')`;

  // @todo think through if / how  we want to handle additional metadata.

  // Then create the table
  await sql`CREATE TABLE ${sql(schemaName)}.event_log (
    id BIGSERIAL PRIMARY KEY,
    event_type ${sql(schemaName)}.event_type NOT NULL,
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
  )`;

  spinnerScheme.succeed("Analytics scheme created");

  // Get all tables in the public schema
  const result =
    await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;

  const tables = result.map((row: { table_name: string }) => row.table_name);

  // Register the log function
  const logChangesPath = new URL(
    "./sql_functions/log_changes.sql",
    import.meta.url
  );
  const insertSql = await Bun.file(logChangesPath).text();
  await sql.unsafe(insertSql);

  // Add triggers for each table with progress indicator
  console.log("\nCreating triggers for tables:");

  for (const table of tables) {
    const spinner = ora(`Creating trigger for ${table}`).start();

    await sql.unsafe(`CREATE TRIGGER ${table}_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.${table}
    FOR EACH ROW
    EXECUTE FUNCTION ${schemaName}.log_table_changes();`);

    spinner.succeed(`Created trigger for ${table}`);
  }

  console.log("\n✨ All triggers created successfully");

  // Create the tight_analytics_agent role
  console.log("\nCreating tight_analytics_agent role:");
  const spinnerRole = ora(`Creating tight_analytics_agent role`).start();

  try {
    // Generate a secure random password using Bun's crypto module
    const password = Buffer.from(crypto.getRandomValues(new Uint8Array(32)))
      .toString("base64")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 32);

    // Execute the SQL with the password parameter
    await sql.unsafe(`
      DO $$
      DECLARE
          password text := '${password}';
      BEGIN
         -- Create the role if it doesn't already exist, or alter it if it does
         IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tight_analytics_agent') THEN
            EXECUTE 'CREATE ROLE tight_analytics_agent LOGIN PASSWORD ' || quote_literal(password);
         ELSE
            EXECUTE 'ALTER ROLE tight_analytics_agent WITH PASSWORD ' || quote_literal(password);
         END IF;

         -- Grant permissions to the user
         EXECUTE 'GRANT CONNECT ON DATABASE ' || current_database() || ' TO tight_analytics_agent';

         -- Public schema permissions
         GRANT USAGE ON SCHEMA public TO tight_analytics_agent;
         GRANT SELECT ON ALL TABLES IN SCHEMA public TO tight_analytics_agent;
         ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO tight_analytics_agent;
         GRANT TRIGGER ON ALL TABLES IN SCHEMA public TO tight_analytics_agent;
         ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRIGGER ON TABLES TO tight_analytics_agent;

         -- Tight analytics schema permissions
         GRANT USAGE ON SCHEMA tight_analytics TO tight_analytics_agent;
         GRANT SELECT, INSERT ON tight_analytics.event_log TO tight_analytics_agent;
         ALTER DEFAULT PRIVILEGES IN SCHEMA tight_analytics GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tight_analytics_agent;
      END $$;
    `);

    spinnerRole.succeed(
      `Created a limited access tight_analytics_agent role with a random password`
    );
    console.log("\nIMPORTANT: Save this password for your analytics agent:");

    console.log(
      "\n\n\nPaste this connection url to the Tight to finish cloud set up:\n"
    );

    // Extract the host part from the database URL (everything after the @ symbol)
    const databaseHost = databaseUrl.includes("@")
      ? databaseUrl.split("@")[1]
      : databaseUrl;

    // Construct the connection string with the extracted host
    const connectionString = `postgresql://tight_analytics_agent:${password}@${databaseHost}`;
    console.log(connectionString);

    return;
  } catch (error: any) {
    spinnerRole.fail(
      `Failed to create tight_analytics_agent role: ${error.message}`
    );
    console.error(error);
  }
}

export async function addTriggersForNewTables(sql: SQL) {
  // Get all tables in the public schema
  const result = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `;

  const tables = result.map((row: { table_name: string }) => row.table_name);

  // Add triggers for each table that doesn't already have one
  console.log("\nChecking and creating triggers for tables:");

  for (const table of tables) {
    const spinner = ora(`Checking trigger for ${table}`).start();

    // Check if trigger exists
    const triggerExists = await sql`
      SELECT 1 
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
        AND event_object_table = ${table}
        AND trigger_name = ${table + "_audit_trigger"}
    `;

    if (triggerExists.length === 0) {
      // Create trigger if it doesn't exist
      await sql.unsafe(`CREATE TRIGGER ${table}_audit_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.${table}
        FOR EACH ROW
        EXECUTE FUNCTION ${schemaName}.log_table_changes();`);

      spinner.succeed(`Created trigger for ${table}`);
    } else {
      spinner.info(`Trigger already exists for ${table}`);
    }
  }

  console.log("\n✨ All triggers checked and created successfully");

  // Check if the tight_analytics_agent role exists
  console.log("\nChecking if tight_analytics_agent role exists:");

  const spinner = ora(`Checking tight_analytics_agent role`).start();

  const roleExists = await sql`
    SELECT 1 FROM pg_roles WHERE rolname = 'tight_analytics_agent'
  `;

  if (roleExists.length === 0) {
    spinner.info(
      `Role 'tight_analytics_agent' does not exist. Creating it now...`
    );

    const password = "passs123";
    await sql.file("./sql_functions/create_user.sql", [password]);
    spinner.succeed(`Created 'tight_analytics_agent' role successfully`);
  } else {
    spinner.succeed(`Role 'tight_analytics_agent' already exists`);
  }
}
