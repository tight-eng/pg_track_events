import { SQL } from "bun";
import ora from "ora";
import crypto from "crypto";
import { existsSync } from "fs";
import { mkdirSync } from "fs";
import kleur from "kleur";

//constants
const schemaName: string = "tight_analytics" as const;

export async function init(tightDir: string, sql: SQL, reset: boolean = false) {
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

  spinnerScheme.succeed(kleur.dim("Analytics scheme created"));

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

  console.log(kleur.dim("\nAll triggers created successfully"));

  if (!existsSync(tightDir)) {
    mkdirSync(tightDir, { recursive: true });
  }

  await createDockerFile(tightDir);
  await createTightAnalyticsFile(tightDir);

  // Display the file structure created
  console.log(kleur.dim("\nFiles created:"));
  console.log(`
tight-analytics/
├── tight.analytics.yaml  # Mapping of database changes to analytics events
└── Dockerfile            # Agent container definition. Run this in your infrastructure.
  `);

  console.log(
    kleur.dim(
      "\nNext Step: Configure your analytics events in tight.analytics.yaml\n"
    )
  );
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
  console.log(kleur.dim("\nChecking and creating triggers for tables:"));

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

  console.log(kleur.dim("All triggers checked and created successfully"));
}

async function createDockerFile(tightDir: string) {
  const dockerFile = `
FROM golang:1.21

# Set the working directory inside the container
WORKDIR /app

# Copy go.mod and go.sum first (for caching)
COPY go.mod go.sum ./

# Download Go modules
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build the Go application
RUN go build -o app .

# Command to run the executable
CMD ["./app"]
`.trimStart();

  await Bun.write(`${tightDir}/Dockerfile`, dockerFile);
}

async function createTightAnalyticsFile(tightDir: string) {
  const tightAnalyticsFile = `
# Mapping from Table Changes to Analytics Events
# Documentation: https://
track:
  users.insert:
    event: "USER_SIGN_UP"
    properties:
      email: "user.email"
      name: "user.name"

  invitations.update:
    cond: "old.status != new.status && new.status == 'accepted' ? 'joined_org' : null"
    joined_org:
      org_id: "invitation.org_id"
# Destionations for events with glob filters
# Documentation: https://
destinations:
  posthog:
    apiKey: "$POSTHOG_API_KEY"
    filter: "*"

  mixpanel:
    apiKey: "static_api_key_here"
    filter: "user_*"
  `.trimStart();

  const analyticsFilePath = `${tightDir}/tight.analytics.yaml`;
  if (!existsSync(analyticsFilePath)) {
    await Bun.write(analyticsFilePath, tightAnalyticsFile);
  }
}
