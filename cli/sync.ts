import { SQL } from "bun";
import ora from "ora";
import crypto from "crypto";
import { existsSync } from "fs";
import { mkdirSync } from "fs";
import kleur from "kleur";
import { SQLBuilder } from "./sql_functions/sql-builder";
import { parseDocument } from "yaml";
import { schemaName } from "./init";
import { IgnoreConfig } from "./config/yaml-schema";
import { addToIgnore } from "./config/yaml-utils";
import path from "path";
import {
  extractExcludedColumns,
  logChangesBuilder,
} from "./sql_functions/log-changes-builder";
const { MultiSelect, Input } = require("enquirer");

export async function addTriggersForNewTables(
  sql: SQL,
  configPath: string,
  ignoreConfig: IgnoreConfig,
  autoApply: boolean = false,
  autoMigrate: boolean = false
) {
  const sqlBuilder = new SQLBuilder(sql);

  const spinner = ora(
    "Scanning for new tables and and triggers that need to be updated..."
  ).start();

  const fullyIgnoredTables = Object.entries(ignoreConfig)
    .filter(([_, value]) => value === "*")
    .map(([table]) => table);

  // Get all tables in the public schema
  const result = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `;

  const tables = result.map((row: { table_name: string }) => row.table_name);

  // Get tables that don't have triggers
  const tablesWithoutTriggers = [];
  const tablesWithTriggers = [];
  const ignoredTablesWithoutTriggers = [];
  const tablesWithUpdatedTriggers = [];
  for (const table of tables) {
    const triggerExists = await sql`
      SELECT 
          t.trigger_name,
          t.event_object_table,
          t.event_manipulation,
          pg_get_functiondef(p.oid) as function_definition
      FROM information_schema.triggers t
      JOIN pg_proc p ON t.action_statement LIKE '%' || p.proname || '%'
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE t.trigger_schema = 'public'
          AND t.event_object_table = ${table}
          AND t.trigger_name = ${table + "_audit_trigger"}
          AND n.nspname = 'tight_analytics';
    `;

    if (triggerExists.length === 0) {
      if (!fullyIgnoredTables.includes(table)) {
        tablesWithoutTriggers.push(table);
      } else {
        ignoredTablesWithoutTriggers.push(table);
      }
    } else {
      // check if ignored has changed
      if (ignoreConfig[table] && ignoreConfig[table] !== "*") {
        const ignoredCols = extractExcludedColumns(
          triggerExists[0].function_definition
        );
        const shouldIgnoreCols = new Set(ignoreConfig[table]);
        // Check if the ignored columns have changed
        const areSetsDifferent =
          ignoredCols.size !== shouldIgnoreCols.size ||
          [...ignoredCols].some((col) => !shouldIgnoreCols.has(col)) ||
          [...shouldIgnoreCols].some((col) => !ignoredCols.has(col));

        if (areSetsDifferent) {
          // Stage a new function with updated ignored columns
          const [functionName, functionBody] = logChangesBuilder(table, [
            ...shouldIgnoreCols,
          ]);
          tablesWithUpdatedTriggers.push(table);
          sqlBuilder.add(
            functionBody,
            `${kleur.dim("~")} ${kleur.bold(functionName)} ${kleur.dim(
              "function updated with new ignored columns for"
            )} ${kleur.bold(table)} table`
          );
        }
      }

      tablesWithTriggers.push(table);
    }
  }

  // to remove
  // Remove triggers for fully ignored tables that have triggers
  let toRemoveCount = 0;
  for (const table of fullyIgnoredTables) {
    if (tablesWithTriggers.includes(table)) {
      sqlBuilder.add(
        `DROP TRIGGER IF EXISTS ${table}_audit_trigger ON public.${table};`,
        `${kleur.dim("-")} ${kleur.bold(table + "_audit_trigger")} ${kleur.dim(
          "will be removed from"
        )} ${kleur.bold(table)} ${kleur.dim("table (ignored in yaml config)")}`
      );
      toRemoveCount++;
    }
  }

  spinner.succeed();
  if (toRemoveCount > 0) {
    console.log(
      kleur.dim(
        `Found ${toRemoveCount} ignored tables with triggers. Staging trigger deletions...`
      )
    );
  }

  if (
    tablesWithoutTriggers.length === 0 &&
    toRemoveCount === 0 &&
    tablesWithUpdatedTriggers.length === 0
  ) {
    console.log(kleur.dim("All tracked tables have triggers. Exiting..."));
    return;
  }

  let newlyIgnoredTables: string[] = [];
  let selectedTables: string[];
  if (autoApply || autoMigrate) {
    selectedTables = tablesWithoutTriggers;
    console.log(
      kleur.dim(
        `Found ${
          selectedTables.length
        } tables without triggers: ${selectedTables.join(", ")}`
      )
    );
  } else {
    if (tablesWithoutTriggers.length > 0) {
      const multi = new MultiSelect({
        name: "value",
        message: `Which new tables do you want to track changes on? ${kleur.dim(
          ignoredTablesWithoutTriggers.length + " ignored tables"
        )} ${kleur.dim(
          "\n(Press space to toggle, arrows to navigate, enter to submit)"
        )}`,
        // this class mutates the choices you give it. copy the array first
        choices: [...tablesWithoutTriggers],
        initial: [...tablesWithoutTriggers],
      });

      selectedTables = await multi.run();

      // Find tables that were not selected for tracking
      newlyIgnoredTables = tablesWithoutTriggers.filter(
        (table) => !selectedTables.includes(table)
      );
    } else {
      selectedTables = [];
    }
  }

  // Add triggers for each selected table
  for (const table of selectedTables) {
    const [functionName, functionBody] = logChangesBuilder(table, []);
    sqlBuilder.add(
      functionBody,
      `${kleur.dim("+")} ${kleur.bold(functionName)} ${kleur.dim(
        "function for"
      )} ${kleur.bold(table)} table trigger`
    );
    sqlBuilder.add(
      `CREATE TRIGGER ${table}_audit_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.${table}
        FOR EACH ROW
        EXECUTE FUNCTION ${schemaName}.log_table_changes();`,
      `${kleur.dim("+")} ${kleur.bold(table + "_audit_trigger")} ${kleur.dim(
        "trigger on"
      )} ${kleur.bold(table)} ${kleur.dim("table")}`
    );
  }

  if (newlyIgnoredTables.length > 0) {
    await addToIgnore(configPath, newlyIgnoredTables);
    console.log(
      kleur.dim(
        `Added ${newlyIgnoredTables.join(", ")} to ignore in ${path.relative(
          process.cwd(),
          configPath
        )}`
      )
    );
  }

  if (sqlBuilder.length === 0) {
    console.log(kleur.dim("No new triggers to add. Exiting..."));
    return;
  }

  console.log(
    `\n\n${kleur.underline("Planned DB Queries")}\n` +
      sqlBuilder.getDescriptions().join("\n")
  );

  if (autoApply) {
    console.log("\n\n");
    const status = await sqlBuilder.commit(true);

    if (!status) {
      console.log(kleur.red("Failed to add triggers"));
      console.log(
        "You may have to manually add the triggers with a migration. Docs here: http://..."
      );
      await sql.close();
      return;
    }
    return;
  }

  if (autoMigrate) {
    const outputFile = "add_triggers.sql";
    console.log(
      kleur.dim(`\nDumping migration to ${kleur.bold(outputFile)}...`)
    );
    await Bun.write(outputFile, sqlBuilder.dump());
    return;
  }

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
      console.log(kleur.red("Failed to add triggers"));
      console.log(
        "You may have to manually add the triggers with a migration. Docs here: http://..."
      );
      await sql.close();
      return;
    }
  } else if (output === "o" || output === "out") {
    const fileOutput = new Input({
      name: "output",
      initial: "add_triggers.sql",
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
}
