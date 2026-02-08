import { Type, type Static } from "typebox";

/**
 * Environment configuration schema.
 * Required fields (no default) will cause server to fail fast if missing.
 */
export const EnvSchema = Type.Object({
  // Server configuration
  PORT: Type.Number({
    default: 3000,
    minimum: 1,
    maximum: 65_535,
  }),
  HOST: Type.String({
    default: "0.0.0.0",
  }),

  // Logging
  LOG_LEVEL: Type.String({
    default: "info",
  }),

  // Required: path to quotes data file
  QUOTES_FILE_PATH: Type.String({
    minLength: 1,
  }),

  // Optional: OpenTelemetry OTLP endpoint
  OTEL_EXPORTER_OTLP_ENDPOINT: Type.Optional(Type.String({ format: "uri" })),
});

/**
 * Validated application configuration type.
 * Access via fastify.config after @fastify/env registration.
 */
export type AppConfig = Static<typeof EnvSchema>;
