#!/usr/bin/env bun
import { Command } from "commander";
import prompts from "prompts";
import { addTriggersForNewTables, init } from "./init";
import { SQL } from "bun";
import path from "path";
import ora from "ora";
import kleur from "kleur";
import { createAgentUser } from "./create-agent-user";
import { existsSync } from "fs";
import { parseConfigFile } from "./config/config";
import { dropTight } from "./drop";
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
  .action(async (options) => {
    const [sql] = await getDBConnection();

    await addTriggersForNewTables(sql);
  });

program
  .command("validate")
  .description(
    "Validates the tight.analytics.yaml configuration is valid and compliant with your db schemas"
  )
  .argument(
    "[config-yml]",
    "manually provide the path to your tight.analytics.yaml"
  )
  .action(async (configYml) => {
    const searchPaths = [
      ...(configYml ? [path.resolve(configYml)] : []),
      path.join(process.cwd(), "tight-analytics", "tight.analytics.yaml"),
      path.join(process.cwd(), "tight.analytics.yaml"),
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
      console.log(kleur.dim("\ntight validate path/to/tight.analytics.yaml\n"));
      process.exit(1);
    }

    console.log(
      kleur.dim(`Running on: ${path.relative(process.cwd(), configPath)}\n\n`)
    );

    const spinner = ora(
      "Validating mapping from database changes to analytics events..."
    ).start();
    const config = await parseConfigFile(configPath);
    if (config.data) {
      spinner.succeed(
        kleur.dim(
          "Validated! Deploy this config in an analytics agent to capture defined events."
        )
      );
    } else if (config.error.length > 0) {
      spinner.fail(
        kleur.red(`${config.error.length} validation errors found.`)
      );
      console.log("\n\n");
      for (const error of config.error) {
        console.log(error.lines);
      }

      console.log("\n");
      console.log(
        kleur.dim(
          `Re-run "tight validate${
            configYml ? " " + configPath : ""
          }" to check again`
        )
      );
    }
  });

program
  .command("drop")
  .description(
    "Drop all Tight Analytics database objects (triggers, tables, roles)"
  )
  .action(async () => {
    console.log(
      kleur.yellow(
        "\n⚠️  WARNING: This will remove all Tight Analytics components from your database"
      )
    );
    console.log(
      kleur.dim(
        "\nThis includes:\n" +
          "- All database triggers\n" +
          "- The tight_analytics schema\n" +
          "- The event_log table\n" +
          "- The tight_analytics_agent user role\n"
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
        "Type 'confirm' to proceed with dropping all Tight Analytics components",
    });

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
