import { SQL } from "bun";
import kleur from "kleur";
import ora from "ora";

export async function dropTight(sql: SQL) {
  try {
    const spinner = ora(
      "Dropping Tight Analytics database components..."
    ).start();

    await sql`
          DO $$
          BEGIN
            -- Revoke public schema permissions
            REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM tight_analytics_agent;
            REVOKE ALL PRIVILEGES ON SCHEMA public FROM tight_analytics_agent;
            
            -- Revoke tight_analytics schema permissions
            REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA tight_analytics FROM tight_analytics_agent;
            REVOKE ALL PRIVILEGES ON SCHEMA tight_analytics FROM tight_analytics_agent;
            
            -- Drop the role
            DROP ROLE IF EXISTS tight_analytics_agent;
          EXCEPTION
            WHEN OTHERS THEN
              RAISE NOTICE 'Error dropping tight_analytics_agent role: %', SQLERRM;
          END $$;
        `;

    await sql`DROP SCHEMA tight_analytics CASCADE`;

    spinner.succeed(
      kleur.green(
        "Successfully removed all Tight Analytics components from your database"
      )
    );
  } catch (error) {
    console.error(kleur.red("\nFailed to drop Tight Analytics components:"));
    console.error(
      kleur.dim(error instanceof Error ? error.message : String(error))
    );
    process.exit(1);
  }
}
