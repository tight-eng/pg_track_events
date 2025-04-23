import { SQL } from "bun";
import ora from "ora";

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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type ${sql(schemaName)}.event_type NOT NULL,
    row_table_name TEXT NOT NULL,
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

  if (dryRun) {
    console.log("Dry run enabled");
  }
}

function upsertFunctions(sql: SQL) {}
