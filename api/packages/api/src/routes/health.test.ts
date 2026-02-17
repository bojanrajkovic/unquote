import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import sensible from "@fastify/sensible";
import { oas3PluginAjv } from "@eropple/fastify-openapi3";

import { registerDependencyInjection } from "../deps/index.js";
import { createTestContainer, createSilentLogger, createMockPlayerStore } from "../../tests/helpers/index.js";
import { healthRoutes } from "./health.js";
import type { PlayerStore } from "../domain/player/types.js";

async function buildHealthFastify(playerStore: PlayerStore | null): Promise<FastifyInstance> {
  const container = createTestContainer({
    logger: createSilentLogger(),
    playerStore,
  });

  const fastify = Fastify({
    logger: false,
    ajv: {
      plugins: [oas3PluginAjv],
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  await fastify.register(sensible);
  await fastify.register(registerDependencyInjection, { container });
  await fastify.register(healthRoutes);
  await fastify.ready();

  return fastify;
}

describe("health routes", () => {
  describe("GET /live", () => {
    let fastify: FastifyInstance;

    beforeEach(async () => {
      fastify = await buildHealthFastify(createMockPlayerStore());
    });

    afterEach(async () => {
      await fastify.close();
    });

    it("returns 200 with ok status (AC4.1)", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/live",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok" });
    });

    it("returns correct content-type header", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/live",
      });

      expect(response.headers["content-type"]).toMatch(/application\/json/);
    });
  });

  describe("GET /ready", () => {
    describe("when playerStore is null (database unconfigured)", () => {
      let fastify: FastifyInstance;

      beforeEach(async () => {
        fastify = await buildHealthFastify(null);
      });

      afterEach(async () => {
        await fastify.close();
      });

      it("returns 200 with database: unconfigured (AC4.2)", async () => {
        const response = await fastify.inject({
          method: "GET",
          url: "/ready",
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ status: "ok", database: { status: "unconfigured", error: null } });
      });
    });

    describe("when database is connected", () => {
      let fastify: FastifyInstance;

      beforeEach(async () => {
        fastify = await buildHealthFastify(createMockPlayerStore());
      });

      afterEach(async () => {
        await fastify.close();
      });

      it("returns 200 with database: connected (AC4.3)", async () => {
        const response = await fastify.inject({
          method: "GET",
          url: "/ready",
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ status: "ok", database: { status: "connected", error: null } });
      });
    });

    describe("when database has an error", () => {
      let fastify: FastifyInstance;

      beforeEach(async () => {
        const errorPlayerStore: PlayerStore = {
          ...createMockPlayerStore(),
          checkHealth: async () => ({ status: "error" as const, error: "connection refused" }),
        };

        fastify = await buildHealthFastify(errorPlayerStore);
      });

      afterEach(async () => {
        await fastify.close();
      });

      it("returns 200 with database error detail (AC4.4)", async () => {
        const response = await fastify.inject({
          method: "GET",
          url: "/ready",
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
          status: "ok",
          database: { status: "error", error: "connection refused" },
        });
      });
    });
  });
});
