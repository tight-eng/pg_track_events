#!/usr/bin/env bun
import { Command } from "commander";
import prompts from "prompts";
import { init } from "./init";
import { addTriggersForNewTables } from "./sync";
import { SQL } from "bun";
import path from "path";
import ora from "ora";
import kleur from "kleur";
import { createAgentUser } from "./create-agent-user";
import { existsSync } from "fs";
import { parseConfigFile } from "./config/config";
import { dropTight } from "./drop";
import { getIntrospectedSchema } from "./config/introspection";
const program = new Command();

program
  .name("init")
  .description("init in an instance of your database")
  .version("1.0.0");

program
  .command("init")
  // .option("--append-migration-file [file]", "append migration file")
  .option("--reset", "drop analytics schema and reinitialize")
  .description("Test command that returns hello world")
  .action(async (options) => {
    const cwd = process.cwd();
    const tightDir = path.join(cwd, "tight-analytics");

    const [sql] = await getDBConnection();

    await init(tightDir, sql, options.reset);
  });

program
  .command("create-agent-user")
  .description("Creates a limited access agent user for analytics")
  .action(async () => {
    const [sql, databaseUrl] = await getDBConnection();
    await createAgentUser(sql, databaseUrl);
  });

program
  .command("apply-triggers")
  .description("scans for new tables and adds triggers for them")
  .option(
    "--auto-apply",
    "add triggers to all non-ignored tables without prompting"
  )
  .option(
    "--auto-migrate",
    "add triggers to all non-ignored tables without prompting"
  )
  .argument(
    "[config-yml]",
    "manually provide the path to your pg_track_events.config.yaml"
  )
  .action(async (configYml, options) => {
    const [sql] = await getDBConnection();
    const introspectedSchema = await getIntrospectedSchema(sql);
    const configPath = await getConfigPath(configYml);
    // skip CEL validation for this command
    const config = await parseConfigFile(configPath, introspectedSchema, true);

    if (config.data) {
      await addTriggersForNewTables(
        sql,
        configPath,
        config.data.ignore || {},
        options.autoApply,
        options.autoMigrate
      );
    } else {
      console.log(
        kleur.red(
          `${
            config.error.length
          } validation errors found. Fix them before syncing.\n\ntight validate ${path.relative(
            process.cwd(),
            configPath
          )}`
        )
      );
      process.exit(1);
    }
  });

program
  .command("validate")
  .description(
    "Validates the pg_track_events.config.yaml configuration is valid and compliant with your db schemas"
  )
  .argument(
    "[config-yml]",
    "manually provide the path to your pg_track_events.config.yaml"
  )
  .action(async (configYml) => {
    const [sql] = await getDBConnection();

    const introspectedSchema = await getIntrospectedSchema(sql);

    const configPath = await getConfigPath(configYml);

    const spinner = ora(
      "Validating mapping from database changes to analytics events..."
    ).start();
    const config = await parseConfigFile(configPath, introspectedSchema);
    if (config.data) {
      spinner.succeed(
        kleur.dim(
          "Validated! Deploy this config in an analytics agent to capture defined events."
        )
      );
      process.exit(0);
    } else if (config.error.length > 0) {
      spinner.fail(
        kleur.red(`${config.error.length} validation errors found.`)
      );
      console.log("\n");
      for (const error of config.error) {
        console.log(error.lines + "\n");
      }

      console.log("\n");
      console.log(
        kleur.dim(
          `Re-run "tight validate${
            configYml ? " " + configPath : ""
          }" to check again`
        )
      );

      process.exit(1);
    }
  });

program
  .command("drop")
  .description(
    "Drop all scheme_for_pg_track_events database objects (triggers, tables, roles)"
  )
  .action(async () => {
    console.log(
      kleur.yellow(
        "\n⚠️  WARNING: This will remove all scheme_for_pg_track_events components from your database"
      )
    );
    console.log(
      kleur.dim(
        "\nThis includes:\n" +
          "- All scheme_for_pg_track_events database triggers\n" +
          "- The scheme_for_pg_track_events schema\n" +
          "- The event_log table\n" +
          "- The scheme_for_pg_track_events_agent user role\n"
      )
    );
    console.log(
      kleur.red(
        "\n🚨 IMPORTANT: This operation may fail if you have active agents running in production.\n" +
          "Please disable all agents before proceeding."
      )
    );

    const confirmation = await prompts({
      type: "text",
      name: "confirm",
      message:
        "Type 'confirm' to proceed with dropping all scheme_for_pg_track_events components",
    });

    if (confirmation.confirm !== "confirm") {
      console.log(kleur.dim("Dropping cancelled"));
      process.exit(0);
    }

    const [sql] = await getDBConnection();

    await dropTight(sql);
  });

program.parse();

// Shared helpers

async function getDBConnection(additionalPrompt: string = "") {
  const getDBUrl = async () => {
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
      const response = await prompts({
        type: "password",
        name: "databaseUrl",
        message: "Database URL " + additionalPrompt,
      });

      return response.databaseUrl;
    }
    return DATABASE_URL;
  };

  const DATABASE_URL = await getDBUrl();

  const spinner = ora("Connecting to database...").start();

  spinner.succeed(kleur.dim("Connected to database"));

  try {
    return [new SQL(DATABASE_URL), DATABASE_URL];
  } catch (error) {
    spinner.fail(kleur.red("Failed to connect to database"));
    console.error(
      kleur.dim(error instanceof Error ? error.message : String(error))
    );
    process.exit(1);
  }
}

async function getConfigPath(configYml: string): Promise<string> {
  const searchPaths = [
    ...(configYml ? [path.resolve(configYml)] : []),
    path.join(process.cwd(), "tight-analytics", "pg_track_events.config.yaml"),
    path.join(process.cwd(), "pg_track_events.config.yaml"),
  ];

  // Find the first config file that exists
  let configPath = null;
  for (const path of searchPaths) {
    if (existsSync(path)) {
      configPath = path;
      break;
    }
  }

  if (!configPath) {
    console.log(
      kleur.red(
        "Configuration file not found searching expected paths. Re-run and provide the path explicitly:"
      )
    );
    console.log(
      kleur.dim("\ntight [command] path/to/pg_track_events.config.yaml\n")
    );
    process.exit(1);
  }

  console.log(
    kleur.dim(
      `Running with config: ${path.relative(process.cwd(), configPath)}\n\n`
    )
  );

  return configPath;
}
