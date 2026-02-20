import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import sensible from "@fastify/sensible";
import { oas3PluginAjv } from "@eropple/fastify-openapi3";

import { registerDependencyInjection } from "../../../deps/index.js";
import { createTestContainer, createMockPlayerStore } from "../../../../tests/helpers/index.js";
import { statsRoute } from "./stats.js";
import type { PlayerStats } from "../types.js";

function createFastify(): FastifyInstance {
  return Fastify({
    logger: false,
    ajv: {
      plugins: [oas3PluginAjv],
    },
  }).withTypeProvider<TypeBoxTypeProvider>();
}

describe("stats route (GET /:code/stats)", () => {
  let fastify: FastifyInstance;

  afterEach(async () => {
    await fastify.close();
  });

  describe("player-stats-api.AC3.1 - success returns full stats shape", () => {
    beforeEach(async () => {
      const container = createTestContainer();

      fastify = createFastify();
      await fastify.register(sensible);
      await fastify.register(registerDependencyInjection, { container });
      await fastify.register(statsRoute);
      await fastify.ready();
    });

    it("returns 200 with full stats for a player", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/TEST-CODE-0000/stats",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty("claimCode", "TEST-CODE-0000");
      expect(body).toHaveProperty("gamesPlayed");
      expect(body).toHaveProperty("gamesSolved");
      expect(body).toHaveProperty("winRate");
      expect(body).toHaveProperty("currentStreak");
      expect(body).toHaveProperty("bestStreak");
      expect(body).toHaveProperty("bestTime");
      expect(body).toHaveProperty("averageTime");
      expect(body).toHaveProperty("recentSolves");
    });
  });

  describe("player-stats-api.AC3.2 - recentSolves is present with expected data", () => {
    beforeEach(async () => {
      const container = createTestContainer();

      fastify = createFastify();
      await fastify.register(sensible);
      await fastify.register(registerDependencyInjection, { container });
      await fastify.register(statsRoute);
      await fastify.ready();
    });

    it("returns recentSolves array with date and completionTime", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/TEST-CODE-0000/stats",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body.recentSolves)).toBe(true);
      expect(body.recentSolves).toHaveLength(2);
      expect(body.recentSolves[0]).toHaveProperty("date", "2026-02-14");
      expect(body.recentSolves[0]).toHaveProperty("completionTime", 60);
      expect(body.recentSolves[1]).toHaveProperty("date", "2026-02-15");
      expect(body.recentSolves[1]).toHaveProperty("completionTime", 45);
    });
  });

  describe("player-stats-api.AC3.3 - zero solves returns null times and zeroed counts", () => {
    beforeEach(async () => {
      const mockStore = {
        ...createMockPlayerStore(),
        getStats: async (): Promise<PlayerStats | null> => ({
          gamesPlayed: 0,
          gamesSolved: 0,
          winRate: 0,
          currentStreak: 0,
          bestStreak: 0,
          bestTime: null,
          averageTime: null,
          recentSolves: [],
        }),
      };
      const container = createTestContainer({ playerStore: mockStore });

      fastify = createFastify();
      await fastify.register(sensible);
      await fastify.register(registerDependencyInjection, { container });
      await fastify.register(statsRoute);
      await fastify.ready();
    });

    it("returns zeroed counts and null times for a player with no solves", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/TEST-CODE-0000/stats",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.gamesPlayed).toBe(0);
      expect(body.gamesSolved).toBe(0);
      expect(body.winRate).toBe(0);
      expect(body.currentStreak).toBe(0);
      expect(body.bestStreak).toBe(0);
      expect(body.bestTime).toBeNull();
      expect(body.averageTime).toBeNull();
      expect(body.recentSolves).toHaveLength(0);
    });
  });

  describe("player-stats-api.AC3.4 - unknown claim code returns 404", () => {
    beforeEach(async () => {
      const mockStore = {
        ...createMockPlayerStore(),
        getStats: async (): Promise<PlayerStats | null> => null,
      };
      const container = createTestContainer({ playerStore: mockStore });

      fastify = createFastify();
      await fastify.register(sensible);
      await fastify.register(registerDependencyInjection, { container });
      await fastify.register(statsRoute);
      await fastify.ready();
    });

    it("returns 404 when player not found", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/UNKNOWN-CODE-9999/stats",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("player-stats-api.AC3.5 - database unavailable returns 503", () => {
    beforeEach(async () => {
      const container = createTestContainer({ playerStore: null });

      fastify = createFastify();
      await fastify.register(sensible);
      await fastify.register(registerDependencyInjection, { container });
      await fastify.register(statsRoute);
      await fastify.ready();
    });

    it("returns 503 when playerStore is null", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/TEST-CODE-0000/stats",
      });

      expect(response.statusCode).toBe(503);
    });
  });
});
