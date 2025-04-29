import { z } from "zod";

// Property getters (CEL expressions)
const celExpressionSchema = z.string();

// Schema for simple events
const simpleEventSchema = z.object({
  event: z.string(),
  properties: z.record(celExpressionSchema).optional(),
});

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

// Schema for API key configuration (either env var or static value)
const apiKeySchema = z.union([
  z.string().regex(/^\$[A-Z_]+$/), // Environment variable format: $VARIABLE_NAME
  z.string(), // Static API key
]);

// Schema for destination configuration
const destinationConfigSchema = z.object({
  apiKey: apiKeySchema,
  filter: z.string().default("*"), // Default to "*" if not specified
});

// Schema for destinations
const destinationsSchema = z
  .record(
    z.string(), // Destination name (e.g., "posthog", "mixpanel")
    destinationConfigSchema
  )
  .optional();

// Main schema for the YAML file
const analyticsConfigSchema = z.object({
  track: trackingConfigSchema,
  destinations: destinationsSchema,
});

export type AnalyticsConfig = z.infer<typeof analyticsConfigSchema>;
export { analyticsConfigSchema };
