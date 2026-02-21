import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";

import { createTestContainer, createMockPlayerStore } from "../../../../tests/helpers/index.js";
import { createTestFastify } from "../../../../tests/helpers/fastify.js";
import { sessionRoute } from "./session.js";
import { encodeGameId } from "../../game/game-id.js";
import { PlayerNotFoundError } from "../types.js";

const validGameId = encodeGameId(DateTime.utc(2026, 2, 15));

describe("session route (POST /:code/session)", () => {
  it("AC2.1: returns 201 with status created for new game", async () => {
    // arrange
    const container = createTestContainer();
    const fastify = await createTestFastify(container, sessionRoute);

    // act
    const response = await fastify.inject({
      method: "POST",
      url: `/TEST-CODE-0000/session`,
      payload: {
        gameId: validGameId,
        completionTime: 60_000,
      },
    });

    // assert
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toHaveProperty("status", "created");

    await fastify.close();
  });

  it("AC2.2: returns 200 with status recorded for previously recorded game", async () => {
    // arrange
    const mockStore = {
      ...createMockPlayerStore(),
      recordSession: async () => "exists" as const,
    };
    const container = createTestContainer({ playerStore: mockStore });
    const fastify = await createTestFastify(container, sessionRoute);

    // act
    const response = await fastify.inject({
      method: "POST",
      url: `/TEST-CODE-0000/session`,
      payload: {
        gameId: validGameId,
        completionTime: 60_000,
      },
    });

    // assert
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty("status", "recorded");

    await fastify.close();
  });

  it("AC2.3: returns 404 when claim code is unknown", async () => {
    // arrange
    const mockStore = {
      ...createMockPlayerStore(),
      recordSession: async (code: string) => {
        throw new PlayerNotFoundError(code);
      },
    };
    const container = createTestContainer({ playerStore: mockStore });
    const fastify = await createTestFastify(container, sessionRoute);

    // act
    const response = await fastify.inject({
      method: "POST",
      url: `/UNKNOWN-CODE-9999/session`,
      payload: {
        gameId: validGameId,
        completionTime: 60_000,
      },
    });

    // assert
    expect(response.statusCode).toBe(404);

    await fastify.close();
  });

  it("AC2.4: returns 404 for invalid game ID", async () => {
    // arrange
    const container = createTestContainer();
    const fastify = await createTestFastify(container, sessionRoute);

    // act
    const response = await fastify.inject({
      method: "POST",
      url: `/TEST-CODE-0000/session`,
      payload: {
        gameId: "invalid-id",
        completionTime: 60_000,
      },
    });

    // assert
    expect(response.statusCode).toBe(404);

    await fastify.close();
  });

  it("AC2.6: passes provided solvedAt as a Date to recordSession", async () => {
    // arrange
    let capturedSolvedAt: Date | undefined;
    const mockStore = {
      ...createMockPlayerStore(),
      recordSession: async (
        _code: string,
        _gameId: string,
        _completionTime: number,
        solvedAt?: Date,
      ): Promise<"created" | "exists"> => {
        capturedSolvedAt = solvedAt;
        return "created" as const;
      },
    };
    const container = createTestContainer({ playerStore: mockStore });
    const fastify = await createTestFastify(container, sessionRoute);
    const solvedAtIso = "2026-01-15T10:30:00.000Z";

    // act
    await fastify.inject({
      method: "POST",
      url: `/TEST-CODE-0000/session`,
      payload: {
        gameId: validGameId,
        completionTime: 60_000,
        solvedAt: solvedAtIso,
      },
    });

    // assert
    expect(capturedSolvedAt).toBeInstanceOf(Date);
    expect(capturedSolvedAt?.toISOString()).toBe(solvedAtIso);

    await fastify.close();
  });

  it("AC2.7: passes undefined to recordSession when solvedAt is omitted", async () => {
    // arrange
    let capturedSolvedAt: Date | undefined = new Date(); // sentinel — will be overwritten
    const mockStore = {
      ...createMockPlayerStore(),
      recordSession: async (
        _code: string,
        _gameId: string,
        _completionTime: number,
        solvedAt?: Date,
      ): Promise<"created" | "exists"> => {
        capturedSolvedAt = solvedAt;
        return "created" as const;
      },
    };
    const container = createTestContainer({ playerStore: mockStore });
    const fastify = await createTestFastify(container, sessionRoute);

    // act
    await fastify.inject({
      method: "POST",
      url: `/TEST-CODE-0000/session`,
      payload: {
        gameId: validGameId,
        completionTime: 60_000,
      },
    });

    // assert
    expect(capturedSolvedAt).toBeUndefined();

    await fastify.close();
  });

  it("AC2.5: returns 503 when database is unavailable", async () => {
    // arrange
    const container = createTestContainer({ playerStore: null });
    const fastify = await createTestFastify(container, sessionRoute);

    // act
    const response = await fastify.inject({
      method: "POST",
      url: `/TEST-CODE-0000/session`,
      payload: {
        gameId: validGameId,
        completionTime: 60_000,
      },
    });

    // assert
    expect(response.statusCode).toBe(503);

    await fastify.close();
  });
});
