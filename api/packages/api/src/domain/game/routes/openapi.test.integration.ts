import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import sensible from "@fastify/sensible";
import fastifyOpenapi3, { oas3PluginAjv } from "@eropple/fastify-openapi3";
import { KeywordCipherGenerator, KEYWORDS, type KeywordSource } from "@unquote/game-generator";
import { JsonQuoteSource } from "../../../sources/json-quote-source.js";

import { registerDependencyInjection } from "../../../deps/index.js";
import { createTestContainer, createSilentLogger, getTestQuotesPath } from "../../../../tests/helpers/index.js";
import { registerGameRoutes } from "./index.js";
import { registerPlayerRoutes } from "../../player/routes/index.js";
import { healthRoutes } from "../../../routes/health.js";

/**
 * OpenAPI schema validation tests.
 * Verifies that routes are correctly documented in OpenAPI spec.
 */
describe("OpenAPI schema", () => {
  let fastify: FastifyInstance;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- OpenAPI spec is a dynamic JSON structure
  let spec: any;

  beforeAll(async () => {
    // arrange (shared): full app with all routes registered for OpenAPI generation
    const quotesPath = getTestQuotesPath();
    const quoteSource = new JsonQuoteSource(quotesPath);
    const keywordSource: KeywordSource = { getKeywords: async () => KEYWORDS };
    const gameGenerator = new KeywordCipherGenerator(quoteSource, keywordSource);

    const container = createTestContainer({
      quoteSource,
      gameGenerator,
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
    await fastify.register(fastifyOpenapi3, {
      openapiInfo: {
        title: "Unquote API",
        version: "0.1.0",
      },
    });
    await fastify.register(registerGameRoutes, { prefix: "/game" });
    await fastify.register(registerPlayerRoutes, { prefix: "/player" });
    await fastify.register(healthRoutes, { prefix: "/health" });
    await fastify.ready();

    const specResponse = await fastify.inject({
      method: "GET",
      url: "/openapi.json",
    });
    spec = specResponse.json();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it("returns valid OpenAPI specification", () => {
    // assert
    expect(spec).toHaveProperty("openapi");
    expect(spec).toHaveProperty("info");
    expect(spec).toHaveProperty("paths");
    expect(spec.info.title).toBe("Unquote API");
    expect(typeof spec).toBe("object");
  });

  it("includes operation metadata for GET /game/today", () => {
    // assert
    const todayPath = spec.paths["/game/today"];

    expect(todayPath).toBeDefined();
    expect(todayPath.get.operationId).toBe("getTodayPuzzle");
    expect(todayPath.get.summary).toBe("Get today's puzzle");
    expect(todayPath.get.tags).toContain("game");
  });

  it("includes operation metadata for GET /game/{date}", () => {
    // assert
    const datePath = spec.paths["/game/{date}"];

    expect(datePath).toBeDefined();
    expect(datePath.get.operationId).toBe("getPuzzleByDate");
    expect(datePath.get.summary).toBe("Get puzzle for a specific date");
    expect(datePath.get.tags).toContain("game");
  });

  it("includes operation metadata for POST /game/{id}/check", () => {
    // assert
    const checkPath = spec.paths["/game/{id}/check"];

    expect(checkPath).toBeDefined();
    expect(checkPath.post.operationId).toBe("checkSolution");
    expect(checkPath.post.summary).toBe("Check solution attempt");
    expect(checkPath.post.tags).toContain("game");
  });

  it("routes respond at /game prefix", async () => {
    // act
    const response = await fastify.inject({
      method: "GET",
      url: "/game/today",
    });

    // assert
    expect(response.statusCode).toBe(200);
  });

  it("extracts named schemas to components", () => {
    // assert
    expect(spec.components?.schemas).toBeDefined();
    expect(spec.components.schemas.PuzzleResponse).toBeDefined();
    expect(spec.components.schemas.CheckRequest).toBeDefined();
    expect(spec.components.schemas.CheckResponse).toBeDefined();
  });

  it("includes operation metadata for POST /player", () => {
    // assert
    const playerPath = spec.paths["/player"];

    expect(playerPath).toBeDefined();
    expect(playerPath.post.operationId).toBe("createPlayer");
    expect(playerPath.post.tags).toContain("player");
  });

  it("includes operation metadata for POST /player/{code}/session", () => {
    // assert
    const sessionPath = spec.paths["/player/{code}/session"];

    expect(sessionPath).toBeDefined();
    expect(sessionPath.post.operationId).toBe("recordSession");
    expect(sessionPath.post.tags).toContain("player");
  });

  it("includes operation metadata for GET /player/{code}/stats", () => {
    // assert
    const statsPath = spec.paths["/player/{code}/stats"];

    expect(statsPath).toBeDefined();
    expect(statsPath.get.operationId).toBe("getPlayerStats");
    expect(statsPath.get.tags).toContain("player");
  });

  it("includes operation metadata for GET /health/live", () => {
    // assert
    const livePath = spec.paths["/health/live"];

    expect(livePath).toBeDefined();
    expect(livePath.get.operationId).toBe("healthLive");
    expect(livePath.get.tags).toContain("health");
  });

  it("includes operation metadata for GET /health/ready", () => {
    // assert
    const readyPath = spec.paths["/health/ready"];

    expect(readyPath).toBeDefined();
    expect(readyPath.get.operationId).toBe("healthReady");
    expect(readyPath.get.tags).toContain("health");
  });
});
