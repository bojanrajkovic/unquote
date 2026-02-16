import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import sensible from "@fastify/sensible";
import { oas3PluginAjv } from "@eropple/fastify-openapi3";
import { DateTime } from "luxon";

import { registerDependencyInjection } from "../../../deps/index.js";
import { createTestContainer, createMockPlayerStore } from "../../../../tests/helpers/index.js";
import { sessionRoute } from "./session.js";
import { encodeGameId } from "../../game/game-id.js";
import { PlayerNotFoundError } from "../types.js";

const validGameId = encodeGameId(DateTime.utc(2026, 2, 15));

function createFastify(): FastifyInstance {
  return Fastify({
    logger: false,
    ajv: {
      plugins: [oas3PluginAjv],
    },
  }).withTypeProvider<TypeBoxTypeProvider>();
}

describe("session route (POST /:code/session)", () => {
  let fastify: FastifyInstance;

  afterEach(async () => {
    await fastify.close();
  });

  describe("player-stats-api.AC2.1 - new game returns 201 created", () => {
    beforeEach(async () => {
      const container = createTestContainer();

      fastify = createFastify();
      await fastify.register(sensible);
      await fastify.register(registerDependencyInjection, { container });
      await fastify.register(sessionRoute);
      await fastify.ready();
    });

    it("returns 201 with status created", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: `/TEST-CODE-0000/session`,
        payload: {
          gameId: validGameId,
          completionTime: 60000,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toHaveProperty("status", "created");
    });
  });

  describe("player-stats-api.AC2.2 - previously recorded game returns 200", () => {
    beforeEach(async () => {
      const mockStore = {
        ...createMockPlayerStore(),
        recordSession: async () => "exists" as const,
      };
      const container = createTestContainer({ playerStore: mockStore });

      fastify = createFastify();
      await fastify.register(sensible);
      await fastify.register(registerDependencyInjection, { container });
      await fastify.register(sessionRoute);
      await fastify.ready();
    });

    it("returns 200 with status recorded", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: `/TEST-CODE-0000/session`,
        payload: {
          gameId: validGameId,
          completionTime: 60000,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty("status", "recorded");
    });
  });

  describe("player-stats-api.AC2.3 - unknown claim code returns 404", () => {
    beforeEach(async () => {
      const mockStore = {
        ...createMockPlayerStore(),
        recordSession: async (code: string) => {
          throw new PlayerNotFoundError(code);
        },
      };
      const container = createTestContainer({ playerStore: mockStore });

      fastify = createFastify();
      await fastify.register(sensible);
      await fastify.register(registerDependencyInjection, { container });
      await fastify.register(sessionRoute);
      await fastify.ready();
    });

    it("returns 404 when player not found", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: `/UNKNOWN-CODE-9999/session`,
        payload: {
          gameId: validGameId,
          completionTime: 60000,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("player-stats-api.AC2.4 - invalid gameId returns 404", () => {
    beforeEach(async () => {
      const container = createTestContainer();

      fastify = createFastify();
      await fastify.register(sensible);
      await fastify.register(registerDependencyInjection, { container });
      await fastify.register(sessionRoute);
      await fastify.ready();
    });

    it("returns 404 for invalid game ID", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: `/TEST-CODE-0000/session`,
        payload: {
          gameId: "invalid-id",
          completionTime: 60000,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("player-stats-api.AC2.5 - database unavailable returns 503", () => {
    beforeEach(async () => {
      const container = createTestContainer({ playerStore: null });

      fastify = createFastify();
      await fastify.register(sensible);
      await fastify.register(registerDependencyInjection, { container });
      await fastify.register(sessionRoute);
      await fastify.ready();
    });

    it("returns 503 when playerStore is null", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: `/TEST-CODE-0000/session`,
        payload: {
          gameId: validGameId,
          completionTime: 60000,
        },
      });

      expect(response.statusCode).toBe(503);
    });
  });
});
