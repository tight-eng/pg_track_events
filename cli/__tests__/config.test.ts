import { expect, test, describe } from "bun:test";
import { parse, stringify } from "yaml";
import { parseConfigFile, verifyCELExpressions } from "../config/config";
import { initWasm } from "../config/wasm";


describe("verify yaml", () => {
test("can parse valid yaml formmat", async () => {
  expect(() => parseConfigFile(__dirname + "/example.yml")).not.toThrow();
  });

test("throws yaml error when invalid yaml", async () => {
  const result = await parseConfigFile(__dirname + "/invalid-yaml.yml");
  expect(result).toMatchInlineSnapshot(`
    {
      "data": undefined,
      "error": [
        {
          "errorLine": 3,
          "lines": 
    "\x1B[1m\x1B[31mImplicit map keys need to be followed by map values\x1B[22m\x1B[39m
     1 | def: 123
     2 | \x1B[31muse:::::[]\x1B[39m
     3 | "
    ,
          "message": "Implicit map keys need to be followed by map values",
          "startLine": 1,
        },
      ],
    }
  `)
});

test("throws zod validation when invalid schema", async () => {
  const result = await parseConfigFile(__dirname + "/invalid-schema.yml");

  expect(result!.error![0].lines).toMatchInlineSnapshot(`
    "\x1B[1m\x1B[31mInvalid event transformation:
    \x1B[2m
    Simple Events must have a name 'event' and a 'properties' object.

    event: SIGN_UP
    properties:
      orgId: "new.org.id"

    Conditional Events must have a 'cond' and one set of properties for each possible event. 

    cond: "old.status != new.status && new.status == 'accepted' ? 'JOINED_ORG' : null"
    JOINED_ORG:
      org_id: "invitation.org_id"
    \x1B[22m\x1B[1m\x1B[22m\x1B[39m
     3 | users.insert:
     4 | \x1B[31m  properties:\x1B[39m
     5 |     email: "user.email"
     6 |     name: "user.name"
     7 | "
  `)
})

describe("verify CEL values", () => {

  test('wasm can be initialized', async () => {
    const wasmlibValidateCELs = await initWasm();
    expect(wasmlibValidateCELs).toBeDefined();
  })

  test("can verify CEL values", async   () => {
    const fileContentsPromise = Bun.file(__dirname + "/example.yml").text();
    const parsedYaml = parse(await fileContentsPromise);
    const result = await verifyCELExpressions(parsedYaml);
    expect(result).toMatchInlineSnapshot(`
      {
        "invalid": [],
        "invalidCount": 0,
        "total": 4,
        "validCount": 4,
      }
    `)
  })
})
})