import { parse, parseDocument, stringify } from "yaml";
import { analyticsConfigSchema, zodErrorToString } from "./yaml-schema";
import { z } from "zod";
import kleur from "kleur";
import { initWasm } from "./wasm";
import {
  allowedTableNames,
  applyIgnoresToSchema,
  DatabaseSchema,
} from "./introspection";

/*
todo 
    [ ]  const lineNumber = fileContents
        .substring(0, startChar)
        .split("\n").length;

        ^^ when these fail you get lines.length, not undefined 

    [ ] errors in post checks will tryigger in same try / catch as schema validation 
*/

type ParseConfigError = {
  message: string;
  startLine: number;
  errorLine: number;
  lines: string;
};

export async function parseConfigFile(
  filePath: string,
  introspectedSchema: any = {},
  skipCELValidation: boolean = false
): Promise<
  | { data: z.infer<typeof analyticsConfigSchema>; error: undefined }
  | { data: undefined; error: ParseConfigError[] }
> {
  const fileContentsPromise = Bun.file(filePath).text();
  const tables = allowedTableNames(introspectedSchema);

  try {
    const errors: ParseConfigError[] = [];
    const fileContents = await fileContentsPromise;
    const parsedYaml = parse(fileContents);
    const document = parseDocument(fileContents);
    const lines = fileContents.split("\n");

    for (const table of Object.keys(parsedYaml.track)) {
      const tableName = table.substring(0, table.lastIndexOf("."));
      const tableNode = document.getIn(["track", table]);

      const yamlNode = tableNode as { range?: [number, number] };
      const startChar = yamlNode.range?.[0];
      const lineNumber = fileContents
        .substring(0, startChar)
        .split("\n").length;

      if (!tables.has(tableName)) {
        const message = `Table ${tableName} does not exist in the database. Cannot track changes to it. `;
        errors.push({
          message,
          startLine: lineNumber,
          errorLine: lineNumber,
          lines: getLinesNear(lines, [lineNumber, lineNumber], message).text,
        });
      }
    }

    if (!skipCELValidation) {
      const celValidation = await verifyCELExpressions(
        parsedYaml,
        introspectedSchema
      );

      for (const invalid of celValidation.invalid) {
        console.log(["track", ...invalid.path]);
        const node = document.getIn(["track", ...invalid.path], true)!;
        const yamlNode = node as { range?: [number, number] };
        const startChar = yamlNode.range?.[0];
        const lineNumber = fileContents
          .substring(0, startChar)
          .split("\n").length;

        const errorMessage = invalid.validationError.replace(
          /^<input>:\d+:\d+:\s*/,
          ""
        );
        errors.push({
          message: errorMessage,
          startLine: lineNumber,
          errorLine: lineNumber,
          lines: getLinesNear(lines, [lineNumber, lineNumber], errorMessage)
            .text,
        });
      }
    }

    if (errors.length > 0) {
      return { data: undefined, error: errors };
    }

    // Validate against schema
    return { data: analyticsConfigSchema.parse(parsedYaml), error: undefined };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const fileContents = await fileContentsPromise;
      const lines = fileContents.split("\n");
      const document = parseDocument(fileContents);

      const flattenedErrors = error.issues.flatMap((issue) => {
        if (issue.code === "invalid_union") {
          const value = document.getIn(issue.path)!;

          if (typeof value === "object" && value !== null && "cond" in value) {
            return issue.unionErrors[0]!.issues;
          } else {
            return issue.unionErrors[1]!.issues;
          }
        }

        return [issue];
      });

      const errorMessages: ParseConfigError[] = flattenedErrors.map((issue) => {
        const node =
          document.getIn(issue.path, true) ||
          document.getIn(issue.path.slice(0, -1), true);
        const yamlNode = node as { range?: [number, number] };

        const startChar = yamlNode.range?.[0];
        const endChar = yamlNode.range?.[1];

        const startLine = fileContents
          .substring(0, startChar)
          .split("\n").length;

        const endLine = fileContents.substring(0, endChar).split("\n").length;

        const message = zodErrorToString(issue);

        const { text } = getLinesNear(lines, [startLine, endLine], message);

        return {
          message,
          startLine,
          errorLine: startLine,
          lines: text,
        };
      });

      return { data: undefined, error: errorMessages };
    }

    if (error instanceof Error) {
      const fileContents = await fileContentsPromise;
      const lines = fileContents.split("\n");
      // Extract line number from error message like "... at line 3, column 1"
      const lineMatch = error.message.match(/at line (\d+)/);
      const lineNumber = lineMatch ? parseInt(lineMatch[1]) : undefined;

      // Extract text before "at line" if it exists
      const beforeLineMatch = error.message.match(/(.*?)(?=at line)/);
      const messageBeforeLine = beforeLineMatch
        ? beforeLineMatch[1].trim()
        : error.message;

      const { text, startLine } = getLinesNear(
        lines,
        [lineNumber ?? 0, lineNumber ?? 0],
        messageBeforeLine
      );
      return {
        data: undefined,
        error: [
          {
            message: messageBeforeLine,
            startLine,
            errorLine: lineNumber!,
            lines: text,
          },
        ],
      };
    }

    throw new Error("Failed to parse configuration file: Unknown error");
  }
}

export async function verifyCELExpressions(
  config: z.infer<typeof analyticsConfigSchema>,
  introspectedSchema: DatabaseSchema = []
) {
  const wasmlibValidateCELs = await initWasm();
  const pendingValidations: {
    path: string[];
    exprKind: "prop" | "cond";
    table: string;
    operation: "insert" | "update" | "delete";
    expr: string;
  }[] = [];

  Object.entries(config.track).forEach(([tablePath, eventConfig]) => {
    // Split tablePath into table and operation (e.g. "users.insert" -> ["users", "insert"])
    const [table, operation] = tablePath.split(".") as [
      string,
      "insert" | "update" | "delete"
    ];

    // Handle conditional events
    if ("cond" in eventConfig) {
      // Verify the condition expression
      const condExpr = eventConfig.cond;

      pendingValidations.push({
        path: [tablePath, "cond"],
        exprKind: "cond",
        table: table,
        operation: operation,
        expr: condExpr,
      });

      // Iterate through each event's properties
      Object.entries(eventConfig).forEach(([key, value]) => {
        if (key !== "cond") {
          // Each key is an event name, value is record of properties
          Object.entries(value as Record<string, string>).forEach(
            ([propPath, propExpr]) => {
              // Full path as array: [tablePath, eventName, propPath]
              const fullPath = [tablePath, key, propPath];

              pendingValidations.push({
                path: fullPath,
                exprKind: "prop",
                table: table,
                operation: operation,
                expr: propExpr,
              });
            }
          );
        }
      });
    }
    // Handle simple events
    else {
      // Iterate through properties if they exist
      if (eventConfig.properties) {
        Object.entries(eventConfig.properties).forEach(
          ([propPath, propExpr]) => {
            // Full path as array: [tablePath, 'properties', propPath]
            const fullPath = [tablePath, "properties", propPath];
            pendingValidations.push({
              path: fullPath,
              exprKind: "prop",
              table: table,
              operation: operation,
              expr: propExpr,
            });
          }
        );
      }
    }
  });

  const result = await wasmlibValidateCELs({
    schema: applyIgnoresToSchema(introspectedSchema, config.ignore || {}),
    cels: pendingValidations,
  });

  const invalid = pendingValidations
    .map((i, index) => {
      return {
        ...i,
        valid: result[index].valid,
        validationError: result[index].validationError,
      };
    })
    .filter(({ valid }) => !valid);

  return {
    invalidCount: invalid.length,
    validCount: pendingValidations.length - invalid.length,
    total: pendingValidations.length,
    invalid,
  };
}

function getLinesNear(
  lines: string[],
  targetLines: [number, number],
  message: string
): { text: string; startLine: number } {
  const startLine = Math.max(0, targetLines[0] - 2);
  const endLine = Math.min(lines.length, targetLines[1] + 3);

  // Find the minimum indentation level, ignoring empty lines
  const minIndent = Math.min(
    ...lines
      .slice(startLine, endLine)
      .filter((line) => line.trim().length > 0)
      .map((line) => line.match(/^\s*/)?.[0].length || 0)
  );

  const lineNumberLength = endLine.toString().length;
  const linesWithHighlight = lines
    .slice(startLine, endLine)
    .map((line, index) => {
      const lineNumber = (startLine + index)
        .toString()
        .padStart(lineNumberLength + 1, " ");
      // Remove the minimum indentation from each line, but preserve empty lines
      const trimmedLine = line.trim().length > 0 ? line.slice(minIndent) : line;
      if (
        index >= targetLines[0] - startLine - 1 &&
        index <= targetLines[1] - startLine - 1
      ) {
        return `${lineNumber} | ${kleur.red(trimmedLine)}`;
      }
      return `${lineNumber} | ${trimmedLine}`;
    })
    .join("\n");

  return {
    text: `${kleur.bold().red(message)}\n${linesWithHighlight}`,
    startLine,
  };
}

const invalidUnionMessage = `Invalid event transformation:
${kleur.dim(`
Simple Events must have a name 'event' and a 'properties' object.

event: SIGN_UP
properties:
  orgId: "new.org.id"

Conditional Events must have a 'cond' and one set of properties for each possible event. 

cond: "old.status != new.status && new.status == 'accepted' ? 'JOINED_ORG' : null"
JOINED_ORG:
  org_id: "invitation.org_id"
`)}`.padStart(3);
