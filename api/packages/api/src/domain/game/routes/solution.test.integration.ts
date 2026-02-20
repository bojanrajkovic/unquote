import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import sensible from "@fastify/sensible";
import { oas3PluginAjv } from "@eropple/fastify-openapi3";
import { KeywordCipherGenerator, KEYWORDS, type KeywordSource } from "@unquote/game-generator";
import { JsonQuoteSource } from "../../../sources/json-quote-source.js";
import { DateTime } from "luxon";

import { registerDependencyInjection } from "../../../deps/index.js";
import { createTestContainer, createSilentLogger, getTestQuotesPath } from "../../../../tests/helpers/index.js";
import { solutionRoutes } from "./solution.js";
import { encodeGameId } from "../game-id.js";

/**
 * Integration tests for solution routes.
 * Uses real gameGenerator and quoteSource to verify end-to-end solution checking.
 */
describe("solution routes integration", () => {
  let fastify: FastifyInstance;
  let quoteSource: JsonQuoteSource;
  let gameGenerator: KeywordCipherGenerator;

  beforeAll(async () => {
    // arrange (shared): real quote source + game generator with test data
    const quotesPath = getTestQuotesPath();
    quoteSource = new JsonQuoteSource(quotesPath);
    const keywordSource: KeywordSource = { getKeywords: async () => KEYWORDS };
    gameGenerator = new KeywordCipherGenerator(quoteSource, keywordSource);

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
    await fastify.register(solutionRoutes);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it("POST /:id/check returns correct: true for correct solution", async () => {
    // arrange
    const dateTime = DateTime.fromISO("2020-05-15", { zone: "utc" });
    const puzzle = await gameGenerator.generateDailyPuzzle(dateTime);
    const quote = await quoteSource.getQuote(puzzle.quoteId);
    const gameId = encodeGameId(dateTime);

    // act
    const response = await fastify.inject({
      method: "POST",
      url: `/${gameId}/check`,
      payload: {
        solution: quote?.text ?? "",
      },
    });

    // assert
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ correct: true });
  });

  it("POST /:id/check returns correct: false for wrong solution", async () => {
    // arrange
    const dateTime = DateTime.fromISO("2020-05-15", { zone: "utc" });
    const gameId = encodeGameId(dateTime);

    // act
    const response = await fastify.inject({
      method: "POST",
      url: `/${gameId}/check`,
      payload: {
        solution: "This is definitely not the correct answer to any quote.",
      },
    });

    // assert
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ correct: false });
  });

  it("POST /:id/check validates solution case-insensitively", async () => {
    // arrange
    const dateTime = DateTime.fromISO("2020-05-15", { zone: "utc" });
    const puzzle = await gameGenerator.generateDailyPuzzle(dateTime);
    const quote = await quoteSource.getQuote(puzzle.quoteId);
    const gameId = encodeGameId(dateTime);

    // act
    const response = await fastify.inject({
      method: "POST",
      url: `/${gameId}/check`,
      payload: {
        solution: (quote?.text ?? "").toUpperCase(),
      },
    });

    // assert
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ correct: true });
  });

  it("POST /:id/check returns 404 for invalid game ID", async () => {
    // act
    const response = await fastify.inject({
      method: "POST",
      url: "/definitely-invalid-id/check",
      payload: {
        solution: "Any solution",
      },
    });

    // assert
    expect(response.statusCode).toBe(404);
  });

  it("POST /:id/check works end-to-end for today's puzzle", async () => {
    // arrange
    const dateTime = DateTime.utc().startOf("day");
    const puzzle = await gameGenerator.generateDailyPuzzle(dateTime);
    const quote = await quoteSource.getQuote(puzzle.quoteId);
    const gameId = encodeGameId(dateTime);

    // act
    const response = await fastify.inject({
      method: "POST",
      url: `/${gameId}/check`,
      payload: {
        solution: quote?.text ?? "",
      },
    });

    // assert
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ correct: true });
  });
});
