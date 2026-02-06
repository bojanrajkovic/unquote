import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import sensible from "@fastify/sensible";
import { oas3PluginAjv } from "@eropple/fastify-openapi3";

import { registerDependencyInjection } from "../deps/index.js";
import { createTestContainer, createSilentLogger } from "../../tests/helpers/index.js";
import { healthRoutes } from "./health.js";

describe("health routes", () => {
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
    it("returns 200 with ok status", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok" });
    });

    it("returns correct content-type header", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/",
      });

      expect(response.headers["content-type"]).toMatch(/application\/json/);
    });
  });
});
