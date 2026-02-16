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

  // Optional: PostgreSQL connection string for player stats
  DATABASE_URL: Type.Optional(Type.String()),

  // CORS allowed origins (comma-separated list, or "*" for all)
  CORS_ORIGIN: Type.String({
    default: "*",
  }),

  // Trust proxy headers (X-Forwarded-For, etc.)
  TRUST_PROXY: Type.Boolean({
    default: false,
  }),

  // Rate limiting
  RATE_LIMIT_MAX: Type.Number({
    default: 100,
    minimum: 1,
  }),
  RATE_LIMIT_WINDOW: Type.String({
    default: "1 minute",
  }),
});

/**
 * Validated application configuration type.
 * Access via fastify.config after @fastify/env registration.
 */
export type AppConfig = Static<typeof EnvSchema>;
