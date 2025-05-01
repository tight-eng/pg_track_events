import { SQL } from "bun";
import kleur from "kleur";
import ora from "ora";

type SQLStatement = {
  statement: string;
  description?: string;
  section?: string;
};

export class SQLBuilder {
  private statements: SQLStatement[] = [];
  private sql: SQL;
  private inTransaction: boolean = false;

  constructor(sql: SQL) {
    this.sql = sql;
  }

  /**
   * Add a SQL statement to the builder
   * @param statement The SQL statement to add
   * @param description Optional description of the statement
   * @param section Optional section name for grouping statements
   */
  add(statement: string, description?: string, section?: string): void {
    this.statements.push({ statement, description, section });
  }

  /**
   * Outputs all the descriptions of the SQL statements
   * @returns An array of descriptions for all statements
   */
  getDescriptions(): string[] {
    return this.statements
      .filter((statement) => statement.description)
      .map((statement) => statement.description as string);
  }

  /**
   * Groups and prints descriptions by section
   * @param showEmpty Whether to show sections with no statements
   */
  printDescriptionsBySection(showEmpty: boolean = false): void {
    // Group statements by section
    const sections: Record<string, string[]> = {};

    this.statements.forEach(({ description, section }) => {
      if (!description) return;

      const sectionName = section || "Default";
      if (!sections[sectionName]) {
        sections[sectionName] = [];
      }

      sections[sectionName].push(description);
    });

    // Print grouped descriptions
    Object.entries(sections).forEach(([sectionName, descriptions]) => {
      if (!showEmpty && descriptions.length === 0) return;

      console.log(kleur.bold(`\n${sectionName}:`));
      descriptions.forEach((desc) => {
        console.log(`  ${desc}`);
      });
    });
  }

  /**
   * Begin a transaction
   */
  async beginTransaction(): Promise<void> {
    if (this.inTransaction) {
      throw new Error("Transaction already in progress");
    }
    await this.sql.begin(async (tx) => {
      // The transaction is started, we just need to mark it
      this.inTransaction = true;
    });
  }

  /**
   * Commit the current transaction
   */
  async commitTransaction(): Promise<void> {
    if (!this.inTransaction) {
      throw new Error("No transaction in progress");
    }
    await this.sql.unsafe("COMMIT");
    this.inTransaction = false;
  }

  /**
   * Rollback the current transaction
   */
  async rollbackTransaction(): Promise<void> {
    if (!this.inTransaction) {
      throw new Error("No transaction in progress");
    }
    await this.sql.unsafe("ROLLBACK");
    this.inTransaction = false;
  }

  /**
   * Execute all collected SQL statements in sequence within a transaction
   * @param useTransaction Whether to execute statements within a transaction
   */
  async commit(useTransaction: boolean = false): Promise<boolean> {
    let currentSpinner;
    try {
      if (useTransaction) {
        console.log(kleur.bold().dim("Starting transaction..."));
        await this.beginTransaction();
      }

      for (const { statement, description } of this.statements) {
        if (description) {
          currentSpinner = ora(kleur.green(description)).start();
          await this.sql.unsafe(statement);
          currentSpinner.succeed();
        } else {
          await this.sql.unsafe(statement);
        }
      }

      if (useTransaction) {
        console.log("\n\n");
        currentSpinner = ora(kleur.dim("Committing transaction...")).start();
        await this.commitTransaction();
        currentSpinner.succeed(kleur.dim("Transaction committed!"));
      }
      return true;
    } catch (error: any) {
      let prefix = currentSpinner?.text || "other statement";
      currentSpinner?.fail("FAILED: " + prefix + " " + error!.message!);

      if (useTransaction && this.inTransaction) {
        console.log("\n\n" + kleur.bold().dim("Rolling back transaction..."));
        const rollbackSpinner = ora("Rolling back transaction...").start();
        await this.rollbackTransaction();
        rollbackSpinner.succeed("Rolled back. Everything is back to normal.");
      }
      return false;
    } finally {
      this.statements = []; // Clear statements after execution
    }
  }

  /**
   * Dump all SQL statements as a single string, separated by newlines
   * @returns A string containing all SQL statements with their descriptions
   */
  dump(): string {
    return this.statements
      .map(({ statement, description, section }) => {
        const parts = [];
        if (section)
          parts.push(`-- Section: ${stripAnsiControlChars(section)}`);
        if (description)
          parts.push(`-- Description: ${stripAnsiControlChars(description)}`);
        parts.push(statement);
        return parts.join("\n");
      })
      .join("\n\n");
  }

  /**
   * Clear all collected statements
   */
  clear(): void {
    this.statements = [];
  }

  /**
   * Get the number of statements currently collected
   */
  get length(): number {
    return this.statements.length;
  }
}

/**
 * Utility function to strip ANSI control/color characters from a string
 * @param input The string containing ANSI control sequences
 * @returns A clean string with all ANSI control sequences removed
 */
function stripAnsiControlChars(input: string): string {
  // This regex matches all ANSI escape sequences used for colors and formatting
  // It includes sequences that start with ESC [ and are followed by various control codes
  const ansiRegex = /\u001b\[\d+(;\d+)*m/g;
  return input.replace(ansiRegex, "");
}
