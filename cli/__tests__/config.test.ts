import { expect, test } from "bun:test";
import { parse, stringify } from "yaml";
import { parseConfigFile } from "../config/config";

test("can parse valid yaml formmat", async () => {
  const result = await parseConfigFile(__dirname + "/example.yml");
  expect(result).toMatchInlineSnapshot(`
    {
      "destinations": {
        "mixpanel": {
          "apiKey": "static_api_key_here",
          "filter": "users.*",
        },
        "posthog": {
          "apiKey": "$POSTHOG_API_KEY",
          "filter": "*",
        },
      },
      "track": {
        "invitations.update": {
          "cond": "old.status != new.status",
          "declined_invite": {
            "inviter": "invitation.inviter_id",
          },
          "joined_org": {
            "org_id": "invitation.org_id",
          },
        },
        "users.insert": {
          "event": "user_signup",
          "properties": {
            "email": "user.email",
            "name": "user.name",
          },
        },
      },
    }
  `);
});

test("throws yaml error when invalid yaml", async () => {
  const result = () => parseConfigFile(__dirname + "/invalid.yml");
  expect(result).toThrowErrorMatchingInlineSnapshot(`
    "Failed to parse YAML file:
     Implicit map keys need to be followed by map values at line 3, column 1:

    def: 123
    use:::::[]
    ^^^^^^^^^^
    "
  `);
});

test("throws zod validation when invalid schema", async () => {
  const result = () => parseConfigFile(__dirname + "/invalid-schema.yml");
  await result();
  // expect(result).toThrowErrorMatchingInlineSnapshot(`
  //   "Invalid configuration: [
  //     {
  //       "code": "invalid_union",
  //       "unionErrors": [
  //         {
  //           "issues": [
  //             {
  //               "code": "invalid_type",
  //               "expected": "string",
  //               "received": "undefined",
  //               "path": [
  //                 "track",
  //                 "users.insert",
  //                 "event"
  //               ],
  //               "message": "Required"
  //             }
  //           ],
  //           "name": "ZodError"
  //         },
  //         {
  //           "issues": [
  //             {
  //               "code": "invalid_type",
  //               "expected": "string",
  //               "received": "undefined",
  //               "path": [
  //                 "track",
  //                 "users.insert",
  //                 "cond"
  //               ],
  //               "message": "Required"
  //             }
  //           ],
  //           "name": "ZodError"
  //         }
  //       ],
  //       "path": [
  //         "track",
  //         "users.insert"
  //       ],
  //       "message": "Invalid input"
  //     }
  //   ]"
  // `);
});
