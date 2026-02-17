import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import sensible from "@fastify/sensible";
import { oas3PluginAjv } from "@eropple/fastify-openapi3";

import { registerDependencyInjection } from "../../../deps/index.js";
import { createTestContainer } from "../../../../tests/helpers/index.js";
import { registerRoute } from "./register.js";

describe("register route (POST /)", () => {
  let fastify: FastifyInstance;

  afterEach(async () => {
    await fastify.close();
  });

  describe("player-stats-api.AC1.1 - success", () => {
    beforeEach(async () => {
      const container = createTestContainer();

      fastify = Fastify({
        logger: false,
        ajv: {
          plugins: [oas3PluginAjv],
        },
      }).withTypeProvider<TypeBoxTypeProvider>();

      await fastify.register(sensible);
      await fastify.register(registerDependencyInjection, { container });
      await fastify.register(registerRoute);
      await fastify.ready();
    });

    it("returns 201 with claimCode from mock store", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/",
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toHaveProperty("claimCode", "TEST-CODE-0000");
    });
  });

  describe("player-stats-api.AC1.2 - database unavailable", () => {
    beforeEach(async () => {
      const container = createTestContainer({ playerStore: null });

      fastify = Fastify({
        logger: false,
        ajv: {
          plugins: [oas3PluginAjv],
        },
      }).withTypeProvider<TypeBoxTypeProvider>();

      await fastify.register(sensible);
      await fastify.register(registerDependencyInjection, { container });
      await fastify.register(registerRoute);
      await fastify.ready();
    });

    it("returns 503 when playerStore is null", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/",
      });

      expect(response.statusCode).toBe(503);
    });
  });
});
