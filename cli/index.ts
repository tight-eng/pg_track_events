#!/usr/bin/env bun
import { Command } from "commander";
import prompts from "prompts";
import { addTriggersForNewTables, init } from "./init";
import { SQL } from "bun";
const program = new Command();

program
  .name("init")
  .description("init in an instance of your database")
  .version("1.0.0");

program
  .command("init")
  .option("--append-migration-file [file]", "append migration file")
  .option("--reset", "drop analytics schema and reinitialize")
  .description("Test command that returns hello world")
  .action(async (options) => {
    const response = await prompts({
      type: "password",
      name: "databaseUrl",
      message: "Database URL",
    });

    await init(response.databaseUrl, options.reset, options.dryRun);
  });

program
  .command("sync-tables")
  .description("Resyncs triggers for all tables")
  .action(async (options) => {
    const response = await prompts({
      type: "password",
      name: "databaseUrl",
      message: "Database URL",
    });

    const sql = new SQL(response.databaseUrl);

    await addTriggersForNewTables(sql);
  });

program.parse();
