import { describe, it, expect } from "vitest";
import { Value } from "typebox/value";
import Ajv from "ajv";
import addFormats from "ajv-formats";

import { EnvSchema } from "../../src/config/schema.js";

/**
 * Mirrors @fastify/env behavior: apply defaults, then validate.
 * Returns a fresh object with defaults populated + any overrides.
 */
function envWith(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const data: Record<string, unknown> = {
    QUOTES_FILE_PATH: "/data/quotes.json",
    ...overrides,
  };
  Value.Default(EnvSchema, data);
  return data;
}

/**
 * AJV instance matching production config (ajv-formats with "uri" format).
 * Used for tests that exercise `format` keywords which TypeBox ignores.
 */
function createAjv(): Ajv {
  const ajv = new Ajv({ allErrors: true, useDefaults: true });
  addFormats(ajv, { mode: "fast", formats: ["uri"] });
  return ajv;
}

describe("EnvSchema", () => {
  describe("required fields", () => {
    it("rejects missing QUOTES_FILE_PATH", () => {
      const data: Record<string, unknown> = {};
      Value.Default(EnvSchema, data);
      expect(Value.Check(EnvSchema, data)).toBe(false);
    });

    it("rejects empty QUOTES_FILE_PATH", () => {
      const data = envWith({ QUOTES_FILE_PATH: "" });
      expect(Value.Check(EnvSchema, data)).toBe(false);
    });

    it("accepts valid QUOTES_FILE_PATH", () => {
      expect(Value.Check(EnvSchema, envWith())).toBe(true);
    });
  });

  describe("defaults", () => {
    it("populates default values via Value.Default", () => {
      const data = envWith();

      expect(data).toMatchObject({
        PORT: 3000,
        HOST: "0.0.0.0",
        LOG_LEVEL: "info",
        CORS_ORIGIN: "*",
        TRUST_PROXY: false,
        RATE_LIMIT_MAX: 100,
        RATE_LIMIT_WINDOW: "1 minute",
      });
    });
  });

  describe("PORT bounds", () => {
    it("rejects port 0", () => {
      expect(Value.Check(EnvSchema, envWith({ PORT: 0 }))).toBe(false);
    });

    it("rejects port above 65535", () => {
      expect(Value.Check(EnvSchema, envWith({ PORT: 65_536 }))).toBe(false);
    });

    it("accepts port 443", () => {
      expect(Value.Check(EnvSchema, envWith({ PORT: 443 }))).toBe(true);
    });
  });

  describe("RATE_LIMIT_MAX bounds", () => {
    it("rejects 0", () => {
      expect(Value.Check(EnvSchema, envWith({ RATE_LIMIT_MAX: 0 }))).toBe(false);
    });

    it("accepts 1", () => {
      expect(Value.Check(EnvSchema, envWith({ RATE_LIMIT_MAX: 1 }))).toBe(true);
    });
  });

  describe("OTEL_EXPORTER_OTLP_ENDPOINT", () => {
    it("accepts omitted value", () => {
      expect(Value.Check(EnvSchema, envWith())).toBe(true);
    });

    it("accepts http endpoint", () => {
      const ajv = createAjv();
      const validate = ajv.compile(EnvSchema);
      const data = envWith({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318" });
      expect(validate(data)).toBe(true);
    });

    it("accepts https endpoint", () => {
      const ajv = createAjv();
      const validate = ajv.compile(EnvSchema);
      const data = envWith({
        OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example.com:4317/v1/traces",
      });
      expect(validate(data)).toBe(true);
    });

    it("rejects value without scheme", () => {
      const ajv = createAjv();
      const validate = ajv.compile(EnvSchema);
      const data = envWith({ OTEL_EXPORTER_OTLP_ENDPOINT: "not a valid uri" });
      expect(validate(data)).toBe(false);
    });
  });
});
