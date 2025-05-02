import { SQL } from "bun";
import { existsSync } from "fs";
import { mkdirSync } from "fs";
import kleur from "kleur";
import { SQLBuilder } from "./sql_functions/sql-builder";
import { parseDocument } from "yaml";
import { logChangesBuilder } from "./sql_functions/log-changes-builder";
import {
  getColumnsForTable,
  getIntrospectedSchema,
} from "./config/introspection";
const { MultiSelect, Input } = require("enquirer");
//constants
export const schemaName: string = "tight_analytics" as const;

export async function init(tightDir: string, sql: SQL, reset: boolean = false) {
  const sqlBuilder = new SQLBuilder(sql);

  const introspectedSchema = await getIntrospectedSchema(sql);

  // Get all tables in the public schema
  const tableQuery =
    await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;

  const tables: string[] = tableQuery
    .map((row: { table_name: string }) => row.table_name)
    .sort();

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
      await sql`DROP SCHEMA ${sql(schemaName)} CASCADE`;
    } else {
      console.log("Already initialized. Exiting... Run with --reset to reset.");
      await sql.close();
      return;
    }
  }

  console.log("\n");

  const multi = new MultiSelect({
    name: "value",
    message: `Which tables do you want to track changes for? ${kleur.dim(
      "\n(Press space to toggle, arrows to navigate, enter to submit)"
    )}`,
    choices: [...tables],
    initial: [...tables],
  });

  const selectedTables = await multi.run();

  // Create an array of ignored tables by finding the difference between all tables and selected tables
  const ignoredTables = tables.filter(
    (table) => !selectedTables.includes(table)
  );

  sqlBuilder.add(
    `CREATE SCHEMA ${schemaName}`,
    `${kleur.dim("+")} ${kleur.bold(schemaName)} ${kleur.dim("schema")}`
  );
  sqlBuilder.add(
    `CREATE TYPE ${schemaName}.event_type AS ENUM ('insert', 'update', 'delete')`
  );

  sqlBuilder.add(
    `CREATE TABLE ${schemaName}.event_log (
    id BIGSERIAL PRIMARY KEY,
    event_type ${schemaName}.event_type NOT NULL,
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
  )`,
    `${kleur.dim("+")} ${kleur.bold("event_log")} ${kleur.dim(
      "table in"
    )} ${kleur.bold(schemaName)} ${kleur.dim("schema")}`
  );

  // Add triggers for each table with progress indicator

  for (const table of selectedTables) {
    const allColumnNames = getColumnsForTable(introspectedSchema, table);

    const [functionName, functionBody] = logChangesBuilder(
      table,
      Array.from(allColumnNames)
    );
    console.log(functionBody);
    sqlBuilder.add(
      functionBody,
      `${kleur.dim("+")} ${kleur.bold(functionName)} ${kleur.dim(
        "function for"
      )} ${kleur.bold(table)} table trigger`
    );
    sqlBuilder.add(
      `CREATE OR REPLACE TRIGGER ${table}_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.${table}
    FOR EACH ROW
    EXECUTE FUNCTION ${functionName}();`,
      `${kleur.dim("+")} ${kleur.bold(table + "_audit_trigger")} ${kleur.dim(
        "trigger on"
      )} ${kleur.bold(table)} ${kleur.dim("table")}`
    );
  }

  console.log(
    `\n\n${kleur.underline("Planned DB Queries")}\n` +
      sqlBuilder.getDescriptions().join("\n")
  );

  console.log("\n\n");
  const applyMethod = new Input({
    name: "key",
    message: `How do you want to apply the changes?\n${`${kleur.dim(
      "apply to db"
    )} ${kleur.blue("(y/yes)")}\n${kleur.dim(
      "dump to migration file "
    )}${kleur.blue("(o/out)")}\n${kleur.dim(
      "exit without taking action"
    )} ${kleur.blue("(enter)")}`}`,
  });

  const output = (await applyMethod.run()).toLowerCase().trim();

  console.log("\n\n");
  if (output === "y" || output === "yes") {
    const status = await sqlBuilder.commit(true);

    if (!status) {
      console.log(kleur.red("Failed to initialize tight_analytics"));
      console.log(
        "You may have to manually set up Tight with a migration. Docs here: http://..."
      );
      await sql.close();
      return;
    }
  } else if (output === "o" || output === "out") {
    const fileOutput = new Input({
      name: "output",
      initial: "tight_analytics_setup.sql",
      message: `Which file do you want to output the changes to? ${kleur.dim(
        "\nAppends by default and creates if does not exist."
      )}`,
    });

    const outputFile = await fileOutput.run();

    // Check if file exists and append if it does
    if (existsSync(outputFile)) {
      const existingContent = await Bun.file(outputFile).text();
      await Bun.write(outputFile, existingContent + "\n\n" + sqlBuilder.dump());
    } else {
      await Bun.write(outputFile, sqlBuilder.dump());
    }
  } else {
    console.log(kleur.dim("Exiting. No database changes made"));
    return process.exit(0);
  }

  if (!existsSync(tightDir)) {
    mkdirSync(tightDir, { recursive: true });
  }

  await createDockerFile(tightDir);
  // Get tables that should be ignored (all tables minus selected tables)

  await createTightAnalyticsFile(tightDir, ignoredTables);

  console.log(
    kleur.dim(
      "\nNext Step: Configure your analytics events in pg_track_events.config.yaml\n"
    )
  );

  console.log(`tight-analytics/
├── pg_track_events.config.yaml  # Mapping of database changes to analytics events
└── Dockerfile            # Agent container definition. Run this in your infrastructure.
  `);
}

async function createDockerFile(tightDir: string) {
  const dockerFile = `
FROM ghcr.io/tight-eng/tightdb/tight-agent:latest

COPY pg_track_events.config.yaml .
`.trimStart();

  await Bun.write(`${tightDir}/Dockerfile`, dockerFile);
}

async function createTightAnalyticsFile(
  tightDir: string,
  ignoredTables: string[]
) {
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
ignore: {}
  `.trimStart();

  const analyticsFilePath = `${tightDir}/pg_track_events.config.yaml`;

  const analyticsFile = existsSync(analyticsFilePath)
    ? parseDocument(await Bun.file(analyticsFilePath).text())
    : parseDocument(tightAnalyticsFile);
  analyticsFile.set(
    "ignore",
    ignoredTables.reduce((acc, table) => {
      acc[table] = "*";
      return acc;
    }, {} as Record<string, string | string[]>)
  );

  await Bun.write(analyticsFilePath, analyticsFile.toString());
}
