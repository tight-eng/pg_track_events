import { parseDocument } from "yaml";

export async function addToIgnore(
  configPath: string,
  newIgnoredTables: string[]
) {
  const config = parseDocument(await Bun.file(configPath).text());

  // Get the existing ignore section or create an empty object if it doesn't exist
  const ignore = config.toJS().ignore || {};
  // Make sure we don't return early so we can update the ignore section
  const update = newIgnoredTables.reduce((acc, table) => {
    acc[table] = "*";
    return acc;
  }, ignore as Record<string, string | string[]>);

  config.set("ignore", update);

  await Bun.write(configPath, config.toString());
}
