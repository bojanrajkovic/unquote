import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import sensible from "@fastify/sensible";
import { oas3PluginAjv } from "@eropple/fastify-openapi3";
import { KeywordCipherGenerator, KEYWORDS, type KeywordSource } from "@unquote/game-generator";
import { JsonQuoteSource } from "../../../sources/index.js";
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
  // Helper to create DateTime from ISO string
  const isoDate = (dateStr: string): DateTime => DateTime.fromISO(dateStr, { zone: "utc" });
  let fastify: FastifyInstance;
  let quoteSource: JsonQuoteSource;
  let gameGenerator: KeywordCipherGenerator;

  beforeAll(async () => {
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

  describe("POST /:id/check", () => {
    it("returns correct: true when solution decrypts to original quote", async () => {
      // Get a puzzle for a known date
      const dateTime = isoDate("2020-05-15");

      // Generate the puzzle to know the original text
      const puzzle = await gameGenerator.generateDailyPuzzle(dateTime);
      const quote = await quoteSource.getQuote(puzzle.quoteId);

      // Encode the game ID
      const gameId = encodeGameId(dateTime);

      // Submit the correct solution
      const response = await fastify.inject({
        method: "POST",
        url: `/${gameId}/check`,
        payload: {
          solution: quote?.text ?? "",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ correct: true });
    });

    it("returns correct: false for wrong solution", async () => {
      const dateTime = isoDate("2020-05-15");
      const gameId = encodeGameId(dateTime);

      const response = await fastify.inject({
        method: "POST",
        url: `/${gameId}/check`,
        payload: {
          solution: "This is definitely not the correct answer to any quote.",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ correct: false });
    });

    it("validates solution case-insensitively", async () => {
      const dateTime = isoDate("2020-05-15");

      const puzzle = await gameGenerator.generateDailyPuzzle(dateTime);
      const quote = await quoteSource.getQuote(puzzle.quoteId);

      const gameId = encodeGameId(dateTime);

      // Submit solution in all uppercase
      const response = await fastify.inject({
        method: "POST",
        url: `/${gameId}/check`,
        payload: {
          solution: (quote?.text ?? "").toUpperCase(),
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ correct: true });
    });

    it("returns 404 for invalid game ID", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/definitely-invalid-id/check",
        payload: {
          solution: "Any solution",
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("integrates correctly: get puzzle then check solution", async () => {
      // 1. Get today's puzzle (need to use puzzle routes for this)
      const dateTime = DateTime.utc().startOf("day");
      const puzzle = await gameGenerator.generateDailyPuzzle(dateTime);
      const quote = await quoteSource.getQuote(puzzle.quoteId);
      const gameId = encodeGameId(dateTime);

      // 2. Check the solution
      const checkResponse = await fastify.inject({
        method: "POST",
        url: `/${gameId}/check`,
        payload: {
          solution: quote?.text ?? "",
        },
      });

      expect(checkResponse.statusCode).toBe(200);
      expect(checkResponse.json()).toEqual({ correct: true });
    });
  });
});
