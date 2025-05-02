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
        "invalid": [
          {
            "expr": "user.email",
            "exprKind": "prop",
            "operation": "insert",
            "path": [
              "users.insert",
              "properties",
              "email",
            ],
            "table": "users",
            "valid": false,
            "validationError": 
      "CEL compilation error: ERROR: <input>:1:1: undeclared reference to 'user' (in container '')
       | user.email
       | ^"
      ,
          },
          {
            "expr": "user.name",
            "exprKind": "prop",
            "operation": "insert",
            "path": [
              "users.insert",
              "properties",
              "name",
            ],
            "table": "users",
            "valid": false,
            "validationError": 
      "CEL compilation error: ERROR: <input>:1:1: undeclared reference to 'user' (in container '')
       | user.name
       | ^"
      ,
          },
          {
            "expr": "old.status != new.status && new.status == 'accepted' ? 'joined_org' : null",
            "exprKind": "cond",
            "operation": "update",
            "path": [
              "invitations.update",
              "cond",
            ],
            "table": "invitations",
            "valid": false,
            "validationError": 
      "CEL compilation error: ERROR: <input>:1:54: found no matching overload for '_?_:_' applied to '(bool, string, null)'
       | old.status != new.status && new.status == 'accepted' ? 'joined_org' : null
       | .....................................................^"
      ,
          },
          {
            "expr": "invitation.org_id",
            "exprKind": "prop",
            "operation": "update",
            "path": [
              "invitations.update",
              "joined_org",
              "org_id",
            ],
            "table": "invitations",
            "valid": false,
            "validationError": 
      "CEL compilation error: ERROR: <input>:1:1: undeclared reference to 'invitation' (in container '')
       | invitation.org_id
       | ^"
      ,
          },
        ],
        "invalidCount": 4,
        "total": 4,
        "validCount": 0,
      }
    `)
  })
})
})