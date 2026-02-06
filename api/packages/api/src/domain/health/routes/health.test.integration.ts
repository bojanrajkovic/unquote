import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import sensible from "@fastify/sensible";
import { oas3PluginAjv } from "@eropple/fastify-openapi3";

import { registerDependencyInjection } from "../../../deps/index.js";
import { createTestContainer, createSilentLogger } from "../../../../tests/helpers/index.js";
import { healthRoutes } from "./health.js";

/**
 * Integration tests for health routes.
 * Verifies the endpoint works with the full plugin stack.
 */
describe("health routes integration", () => {
  let fastify: FastifyInstance;

  beforeAll(async () => {
    const container = createTestContainer({
      logger: createSilentLogger(),
    });

    fastify = Fastify({
      logger: false,
      ajv: {
        plugins: [oas3PluginAjv],
      },
    }).withTypeProvider<TypeBoxTypeProvider>();

    await fastify.register(sensible);
    await fastify.register(registerDependencyInjection, { container });
    await fastify.register(healthRoutes);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  describe("GET /", () => {
    it("returns ok status with valid JSON response", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/",
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty("status");
      expect(body.status).toBe("ok");
    });

    it("returns consistent response on repeated calls", async () => {
      const response1 = await fastify.inject({ method: "GET", url: "/" });
      const response2 = await fastify.inject({ method: "GET", url: "/" });

      expect(response1.json()).toEqual(response2.json());
    });
  });
});
