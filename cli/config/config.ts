import { parse, parseDocument, stringify } from "yaml";
import { analyticsConfigSchema } from "./yaml-schema";
import { z } from "zod";
import kleur from 'kleur';

type ParseConfigError = {
  message: string;
  startLine: number;
  errorLine: number;
  lines: string;
}

export async function parseConfigFile(
  filePath: string
): Promise<{ data: z.infer<typeof analyticsConfigSchema>; error: undefined } | { data: undefined; error: ParseConfigError[] }> {
  const fileContentsPromise = Bun.file(filePath).text();

  try {
    const fileContents = await fileContentsPromise;
    const parsedYaml = parse(fileContents);


    const celValidation = verifyCELExpressions(parsedYaml)

    if (celValidation.invalidCount > 0) {

      const fileContents = await fileContentsPromise;
      const lines = fileContents.split("\n");
      const errors: ParseConfigError[] = [];
      const document = parseDocument(fileContents);

      for (const expr of celValidation.invalid) {

        const node = document.getIn(expr.path)!;
        const yamlNode = node as { range?: [number, number] };
        const startChar = yamlNode.range?.[0];
        const lineNumber = fileContents
          .substring(0, startChar)
          .split("\n").length;

        const { text, startLine } = getLinesNear(lines, lineNumber, expr.error!);
        errors.push({
          message: `Invalid CEL expression: ${expr.error}`,
          startLine,
          errorLine: lineNumber,
          lines: text
        });
      }

      return { data: undefined, error: errors };
    }



    // Validate against schema
    return { data: analyticsConfigSchema.parse(parsedYaml), error: undefined };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const fileContents = await fileContentsPromise;
      const lines = fileContents.split("\n");
      const document = parseDocument(fileContents);

      // Process each validation error
      const errorMessages: ParseConfigError[] = error.issues.map((issue) => {
        const node = document.getIn(issue.path)!;
        const yamlNode = node as { range?: [number, number] };
        const startChar = yamlNode.range?.[0];
        const lineNumber = fileContents
          .substring(0, startChar)
          .split("\n").length;

        const message = issue.code === "invalid_union" && issue.path.length === 2 && issue.path[0] === "track" ? invalidUnionMessage : issue.message;

        const { text, startLine } = getLinesNear(lines, lineNumber!, message )
              
        return {
          message,
          startLine,
          errorLine: lineNumber!,
          lines: text
        }

      });
            
      return { data: undefined, error: errorMessages }
    }

    if (error instanceof Error) {
      const fileContents = await fileContentsPromise;
      const lines = fileContents.split("\n");
            // Extract line number from error message like "... at line 3, column 1"
      const lineMatch = error.message.match(/at line (\d+)/);
      const lineNumber = lineMatch ? parseInt(lineMatch[1]) : undefined;

      // Extract text before "at line" if it exists
      const beforeLineMatch = error.message.match(/(.*?)(?=at line)/);
      const messageBeforeLine = beforeLineMatch ? beforeLineMatch[1].trim() : error.message;

      const { text, startLine } = getLinesNear(lines, lineNumber!, messageBeforeLine )
      return { data: undefined, error: [{
        message: messageBeforeLine,
        startLine,
        errorLine: lineNumber!,
        lines: text
      }]}
    }

    throw new Error("Failed to parse configuration file: Unknown error");
  }
}

export function verifyCELExpressions(config: z.infer<typeof analyticsConfigSchema>, introspectedSchema = {}) {

  const validations: ({path: string[], error: string | undefined})[] = []

  function validate(expression: string): {valid: boolean, error: string | undefined} {
    if (expression.includes('user.name')) {
      return {valid: true, error: undefined}
    }
    return {valid: false, error: 'Invalid CEL expression'}
  }

  Object.entries(config.track).forEach(([tablePath, eventConfig]) => {
    // Handle conditional events
    if ('cond' in eventConfig) {
      // Verify the condition expression
      const condExpr = eventConfig.cond;

      validations.push({path: [tablePath, 'cond'], error: validate(condExpr).error}) 
      
      // Iterate through each event's properties
      Object.entries(eventConfig).forEach(([key, value]) => {
        if (key !== 'cond') {
          // Each key is an event name, value is record of properties
          Object.entries(value as Record<string, string>).forEach(([propPath, propExpr]) => {
            // Full path as array: [tablePath, eventName, propPath]
            const fullPath = [tablePath, key, propPath];

            validations.push({path: fullPath, error: validate(propExpr).error})
          });
        }
      });
    }
    // Handle simple events
    else {
      // Iterate through properties if they exist
      if (eventConfig.properties) {
        Object.entries(eventConfig.properties).forEach(([propPath, propExpr]) => {
          // Full path as array: [tablePath, 'properties', propPath]
          const fullPath = [tablePath, 'properties', propPath];
          validations.push({path: fullPath, error: validate(propExpr).error})
        });
      }
    }
  });

  const valid =  validations.filter(({error}) => error === undefined)
  const invalid = validations.filter(({error}) => error !== undefined)  


  return {
    invalid,
    validCount: valid.length, 
    invalidCount: invalid.length,
    total: validations.length
  }
}

function getLinesNear(lines: string[], targetLine: number, message: string): { text: string, startLine: number } {
  const startLine = Math.max(0, targetLine - 2);
  const endLine = Math.min(lines.length, targetLine + 3);

  // Find the minimum indentation level, ignoring empty lines
  const minIndent = Math.min(...lines.slice(startLine, endLine)
    .filter(line => line.trim().length > 0)
    .map(line => line.match(/^\s*/)?.[0].length || 0));

  const lineNumberLength = endLine.toString().length;
  const linesWithHighlight = lines.slice(startLine, endLine).map((line, index) => {
    const lineNumber = (startLine + index).toString().padStart(lineNumberLength + 1, ' ');
    // Remove the minimum indentation from each line, but preserve empty lines
    const trimmedLine = line.trim().length > 0 ? line.slice(minIndent) : line;
    if (index === targetLine - startLine - 1) {
      return `${lineNumber} | ${kleur.red(trimmedLine)}`;
    }
    return `${lineNumber} | ${trimmedLine}`;
  }).join("\n");

  return {
    text: `${kleur.bold().red(message)}\n${linesWithHighlight}`,
    startLine
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
`)}`.padStart(3)