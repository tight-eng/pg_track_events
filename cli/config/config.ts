import { parse, parseDocument, stringify } from "yaml";
import { analyticsConfigSchema } from "./yaml-schema";
import { z } from "zod";

/**
 * Parses a YAML file and validates it against the analyticsConfigSchema
 * @param filePath Path to the YAML file
 * @returns Parsed and validated configuration
 * @throws Error if the file cannot be read or if the configuration is invalid
 */
export async function parseConfigFile(
  filePath: string
): Promise<z.infer<typeof analyticsConfigSchema>> {
  const fileContentsPromise = Bun.file(filePath).text();

  try {
    const fileContents = await fileContentsPromise;
    const parsedYaml = parse(fileContents);

    // Validate against schema
    return analyticsConfigSchema.parse(parsedYaml);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const fileContents = await fileContentsPromise;
      const document = parseDocument(fileContents);

      // Process each validation error
      const errorMessages = error.issues.map((issue) => {
        const node = document.getIn(issue.path)!;
        const yamlNode = node as { range?: [number, number] };
        const startChar = yamlNode.range?.[0];
        const lineNumber = fileContents
          .substring(0, startChar)
          .split("\n").length;
        const nodeValue = node.toString();

        let errorMessage = `Error at line ${lineNumber}: `;

        if (issue.code === "invalid_union") {
          errorMessage += "Invalid event configuration. Must be either:\n";
          errorMessage += "  - A conditional event with 'cond' field\n";
          errorMessage += "  - A simple event with 'event' field";
        } else {
          errorMessage += issue.message;
        }

        return errorMessage;
      });

      throw new Error(`Invalid configuration:\n${errorMessages.join("\n\n")}`);
    }

    if (error instanceof Error) {
      throw new Error(`Failed to parse YAML file: ${error.message}`);
    }

    throw new Error("Failed to parse configuration file: Unknown error");
  }
}
