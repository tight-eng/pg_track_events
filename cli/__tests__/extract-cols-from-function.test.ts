import { expect, test } from "bun:test";
import { extractColumnsFromFunction, logChangesBuilder } from "../sql_functions/log-changes-builder";

test("can extract current columns from function body", () => {
  const columns = extractColumnsFromFunction(example);
  expect(columns).toEqual(
    new Set([
      "affiliation",
      "average_lifespan",
      "force_sensitive",
      "homeworld",
      "id",
      "notable_character",
      "species_name",
    ])
  );
});

test("can extract single columns from function body", () => {
  const columns = extractColumnsFromFunction(exampleOneCol);
  expect(columns).toEqual(new Set(["affiliation"]));
});

const example = logChangesBuilder("alien_types", 
    ["affiliation",
      "average_lifespan",
      "force_sensitive",
      "homeworld",
      "id",
      "notable_character",
      "species_name"
    ]
);

const exampleOneCol = logChangesBuilder("alien_types", 
    ["affiliation"]
);
