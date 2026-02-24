import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";

import { createTestContainer, createMockPlayerStore } from "../../../../tests/helpers/index.js";
import { createTestFastify } from "../../../../tests/helpers/fastify.js";
import { sessionLookupRoute } from "./session-lookup.js";
import { encodeGameId } from "../../game/game-id.js";

const validGameId = encodeGameId(DateTime.utc(2026, 2, 15));

describe("session-lookup route (GET /:code/session/:gameId)", () => {
  it("cross-client-sync.AC1.1: returns 200 with session data when player has a recorded session", async () => {
    // arrange
    const container = createTestContainer();
    const fastify = await createTestFastify(container, sessionLookupRoute);

    // act
    const response = await fastify.inject({
      method: "GET",
      url: `/TEST-CODE-0000/session/${validGameId}`,
    });

    // assert
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty("completionTime");
    expect(body).toHaveProperty("solvedAt");
    expect(typeof body.completionTime).toBe("number");
    expect(typeof body.solvedAt).toBe("string");

    await fastify.close();
  });

  it("cross-client-sync.AC1.2: returns completionTime in milliseconds and solvedAt as ISO 8601", async () => {
    // arrange
    const container = createTestContainer();
    const fastify = await createTestFastify(container, sessionLookupRoute);

    // act
    const response = await fastify.inject({
      method: "GET",
      url: `/TEST-CODE-0000/session/${validGameId}`,
    });

    // assert
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.completionTime).toBe(53_260);
    expect(body.solvedAt).toBe("2026-02-23T22:15:30.000Z");

    await fastify.close();
  });

  it("cross-client-sync.AC1.3: returns 404 when player exists but has no session for the given game ID", async () => {
    // arrange
    const mockStore = {
      ...createMockPlayerStore(),
      getSession: async (): Promise<null> => null,
    };
    const container = createTestContainer({ playerStore: mockStore });
    const fastify = await createTestFastify(container, sessionLookupRoute);

    // act
    const response = await fastify.inject({
      method: "GET",
      url: `/TEST-CODE-0000/session/${validGameId}`,
    });

    // assert
    expect(response.statusCode).toBe(404);

    await fastify.close();
  });

  it("cross-client-sync.AC1.4: returns 404 when claim code does not match any player", async () => {
    // arrange
    const mockStore = {
      ...createMockPlayerStore(),
      getSession: async (): Promise<null> => null,
    };
    const container = createTestContainer({ playerStore: mockStore });
    const fastify = await createTestFastify(container, sessionLookupRoute);

    // act
    const response = await fastify.inject({
      method: "GET",
      url: `/UNKNOWN-CODE-9999/session/${validGameId}`,
    });

    // assert
    expect(response.statusCode).toBe(404);

    await fastify.close();
  });

  it("cross-client-sync.AC1.5: returns 503 when database is unavailable", async () => {
    // arrange
    const container = createTestContainer({ playerStore: null });
    const fastify = await createTestFastify(container, sessionLookupRoute);

    // act
    const response = await fastify.inject({
      method: "GET",
      url: `/TEST-CODE-0000/session/${validGameId}`,
    });

    // assert
    expect(response.statusCode).toBe(503);

    await fastify.close();
  });

  it("cross-client-sync.AC1.6: returns 404 for an invalid/malformed game ID", async () => {
    // arrange
    const container = createTestContainer();
    const fastify = await createTestFastify(container, sessionLookupRoute);

    // act
    const response = await fastify.inject({
      method: "GET",
      url: `/TEST-CODE-0000/session/invalid-id`,
    });

    // assert
    expect(response.statusCode).toBe(404);

    await fastify.close();
  });
});
