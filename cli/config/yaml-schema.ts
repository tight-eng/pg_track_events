import kleur from "kleur";
import { z } from "zod";

// Property getters (CEL expressions)
const celExpressionSchema = z.string();

// Schema for simple events
const simpleEventSchema = z
  .object({
    event: z.string(),
    properties: z.record(celExpressionSchema).optional(),
  })
  .strict();

// Schema for conditional events
const conditionalEventSchema = z
  .object({
    cond: z.string(),
  })
  .catchall(z.record(celExpressionSchema));

// Union type for event configurations
const eventConfigSchema = z
  .union([conditionalEventSchema, simpleEventSchema])
  .superRefine((val, ctx) => {
    const conditionalResult = conditionalEventSchema.safeParse(val);
    const simpleResult = simpleEventSchema.safeParse(val);

    if (!conditionalResult.success && !simpleResult.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Must match either a conditional event (needs `cond`) or a simple event (needs `event`).",
      });
    }
  });

// Schema for tracking configuration
const trackingConfigSchema = z.record(
  // Key pattern: table_name.insert|update|delete
  z.string().regex(/^[a-zA-Z0-9_]+\.(insert|update|delete)$/),
  // Value is either a simple event or conditional event
  eventConfigSchema
);

// Schema for destination configuration
const destinationConfigSchema = z.object({
  // TODO Make this stricter to validate setup of db event destinations
  filter: z.string().default("*"), // Default to "*" if not specified
});

// Schema for destinations
const destinationsSchema = z
  .record(
    z.string(), // Destination name (e.g., "posthog", "mixpanel")
    destinationConfigSchema
  )
  .optional();

// Ignore schema
const ignoreSchema = z.record(
  z.string(), // Table name
  z.union([
    z.literal("*"), // Ignore all columns
    z.array(z.string()), // Array of column names to ignore
  ])
);

const rawDBEventDestinationSchema= z.object({
  // TODO Make this stricter to validate setup of db event destinations
  filter: z.string().default("*"), // Default to "*" if not specified
});

const rawDBEventDestinationsSchema = z
.record(
  z.string(), // Destination name (e.g., "s3", "bigquery")
  rawDBEventDestinationSchema
)
.optional();

// Main schema for the YAML file
const analyticsConfigSchema = z
  .object({
    track: trackingConfigSchema,
    ignore: ignoreSchema.optional(),
    destinations: destinationsSchema,
    raw_db_event_destinations: rawDBEventDestinationsSchema,
  })
  .strict();

export type AnalyticsConfig = z.infer<typeof analyticsConfigSchema>;
export { analyticsConfigSchema };

export function zodErrorToString(issue: z.ZodError["issues"][0]) {
  if (
    issue.path.length === 2 &&
    issue.path[0] === "track" &&
    issue.code === "invalid_string" &&
    issue.validation === "regex"
  ) {
    return `Transforms must be named {table}.{insert|update|delete}`;
  }

  return issue.message;
}

export type IgnoreConfig = z.infer<typeof ignoreSchema>;
