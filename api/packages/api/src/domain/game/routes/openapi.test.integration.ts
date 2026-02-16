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

  beforeAll(async () => {
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
  });

  afterAll(async () => {
    await fastify.close();
  });

  it("returns OpenAPI specification", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/openapi.json",
    });

    expect(response.statusCode).toBe(200);

    const spec = response.json();
    expect(spec).toHaveProperty("openapi");
    expect(spec).toHaveProperty("info");
    expect(spec).toHaveProperty("paths");
    expect(spec.info.title).toBe("Unquote API");
  });

  it("OpenAPI spec is valid JSON schema", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/openapi.json",
    });

    const spec = response.json();

    // Verify basic OpenAPI structure
    expect(spec.openapi).toBeTruthy();
    expect(spec.info).toBeTruthy();
    expect(spec.paths).toBeTruthy();

    // Verify it's a valid object (not empty)
    expect(typeof spec).toBe("object");
  });

  it("includes operation metadata for GET /game/today", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/openapi.json",
    });

    const spec = response.json();
    const todayPath = spec.paths["/game/today"];

    expect(todayPath).toBeDefined();
    expect(todayPath.get.operationId).toBe("getTodayPuzzle");
    expect(todayPath.get.summary).toBe("Get today's puzzle");
    expect(todayPath.get.tags).toContain("game");
  });

  it("includes operation metadata for GET /game/{date}", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/openapi.json",
    });

    const spec = response.json();
    const datePath = spec.paths["/game/{date}"];

    expect(datePath).toBeDefined();
    expect(datePath.get.operationId).toBe("getPuzzleByDate");
    expect(datePath.get.summary).toBe("Get puzzle for a specific date");
    expect(datePath.get.tags).toContain("game");
  });

  it("includes operation metadata for POST /game/{id}/check", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/openapi.json",
    });

    const spec = response.json();
    const checkPath = spec.paths["/game/{id}/check"];

    expect(checkPath).toBeDefined();
    expect(checkPath.post.operationId).toBe("checkSolution");
    expect(checkPath.post.summary).toBe("Check solution attempt");
    expect(checkPath.post.tags).toContain("game");
  });

  it("routes respond at /game prefix", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/game/today",
    });

    expect(response.statusCode).toBe(200);
  });

  it("extracts named schemas to components", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/openapi.json",
    });

    const spec = response.json();

    // Verify schemas are extracted to components
    expect(spec.components?.schemas).toBeDefined();
    expect(spec.components.schemas.PuzzleResponse).toBeDefined();
    expect(spec.components.schemas.CheckRequest).toBeDefined();
    expect(spec.components.schemas.CheckResponse).toBeDefined();
  });

  it("includes operation metadata for POST /player", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/openapi.json",
    });

    const spec = response.json();
    const playerPath = spec.paths["/player"];

    expect(playerPath).toBeDefined();
    expect(playerPath.post.operationId).toBe("createPlayer");
    expect(playerPath.post.tags).toContain("player");
  });

  it("includes operation metadata for POST /player/{code}/session", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/openapi.json",
    });

    const spec = response.json();
    const sessionPath = spec.paths["/player/{code}/session"];

    expect(sessionPath).toBeDefined();
    expect(sessionPath.post.operationId).toBe("recordSession");
    expect(sessionPath.post.tags).toContain("player");
  });

  it("includes operation metadata for GET /player/{code}/stats", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/openapi.json",
    });

    const spec = response.json();
    const statsPath = spec.paths["/player/{code}/stats"];

    expect(statsPath).toBeDefined();
    expect(statsPath.get.operationId).toBe("getPlayerStats");
    expect(statsPath.get.tags).toContain("player");
  });

  it("includes operation metadata for GET /health/live", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/openapi.json",
    });

    const spec = response.json();
    const livePath = spec.paths["/health/live"];

    expect(livePath).toBeDefined();
    expect(livePath.get.operationId).toBe("healthLive");
    expect(livePath.get.tags).toContain("health");
  });

  it("includes operation metadata for GET /health/ready", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/openapi.json",
    });

    const spec = response.json();
    const readyPath = spec.paths["/health/ready"];

    expect(readyPath).toBeDefined();
    expect(readyPath.get.operationId).toBe("healthReady");
    expect(readyPath.get.tags).toContain("health");
  });
});
