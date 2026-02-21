import { describe, it, expect } from "vitest";

import { createTestContainer, createMockPlayerStore } from "../../../../tests/helpers/index.js";
import { createTestFastify } from "../../../../tests/helpers/fastify.js";
import { statsRoute } from "./stats.js";
import type { PlayerStats } from "../types.js";

describe("stats route (GET /:code/stats)", () => {
  it("AC3.1: returns 200 with full stats shape", async () => {
    // arrange
    const container = createTestContainer();
    const fastify = await createTestFastify(container, statsRoute);

    // act
    const response = await fastify.inject({
      method: "GET",
      url: "/TEST-CODE-0000/stats",
    });

    // assert
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

    await fastify.close();
  });

  it("AC3.2: returns recentSolves with expected data", async () => {
    // arrange
    const container = createTestContainer();
    const fastify = await createTestFastify(container, statsRoute);

    // act
    const response = await fastify.inject({
      method: "GET",
      url: "/TEST-CODE-0000/stats",
    });

    // assert
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body.recentSolves)).toBe(true);
    expect(body.recentSolves).toHaveLength(2);
    expect(body.recentSolves[0]).toHaveProperty("date", "2026-02-14");
    expect(body.recentSolves[0]).toHaveProperty("completionTime", 60);
    expect(body.recentSolves[1]).toHaveProperty("date", "2026-02-15");
    expect(body.recentSolves[1]).toHaveProperty("completionTime", 45);

    await fastify.close();
  });

  it("AC3.3: returns zeroed counts and null times for player with no solves", async () => {
    // arrange
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
    const fastify = await createTestFastify(container, statsRoute);

    // act
    const response = await fastify.inject({
      method: "GET",
      url: "/TEST-CODE-0000/stats",
    });

    // assert
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

    await fastify.close();
  });

  it("AC3.4: returns 404 when claim code is unknown", async () => {
    // arrange
    const mockStore = {
      ...createMockPlayerStore(),
      getStats: async (): Promise<PlayerStats | null> => null,
    };
    const container = createTestContainer({ playerStore: mockStore });
    const fastify = await createTestFastify(container, statsRoute);

    // act
    const response = await fastify.inject({
      method: "GET",
      url: "/UNKNOWN-CODE-9999/stats",
    });

    // assert
    expect(response.statusCode).toBe(404);

    await fastify.close();
  });

  it("AC3.5: returns 503 when database is unavailable", async () => {
    // arrange
    const container = createTestContainer({ playerStore: null });
    const fastify = await createTestFastify(container, statsRoute);

    // act
    const response = await fastify.inject({
      method: "GET",
      url: "/TEST-CODE-0000/stats",
    });

    // assert
    expect(response.statusCode).toBe(503);

    await fastify.close();
  });
});
