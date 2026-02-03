import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import sensible from "@fastify/sensible";
import { oas3PluginAjv } from "@eropple/fastify-openapi3";
import type { GameGenerator, Puzzle, Quote, QuoteSource } from "@unquote/game-generator";
import { DateTime } from "luxon";

import { registerDependencyInjection } from "../../../deps/index.js";
import { createTestContainer, createSilentLogger } from "../../../../tests/helpers/index.js";
import { solutionRoutes } from "./solution.js";
import { encodeGameId } from "../game-id.js";

describe("solution routes", () => {
  let fastify: FastifyInstance;

  const mockQuote: Quote = {
    id: "test-quote-1",
    text: "The quick brown fox jumps over the lazy dog.",
    author: "Test Author",
    category: "test",
    difficulty: 50,
  };

  const mockPuzzle: Puzzle = {
    quoteId: "test-quote-1",
    encryptedText: "GUR DHVPX OEBJA SBK WHZCF BIRE GUR YNML QBT.",
    mapping: { a: "N", b: "O", c: "P" },
    hints: [
      { cipherLetter: "G", plainLetter: "T" },
      { cipherLetter: "Q", plainLetter: "U" },
    ],
  };

  const mockQuoteSource: QuoteSource = {
    getQuote: async (id: string) => (id === mockQuote.id ? mockQuote : null),
    getRandomQuote: async () => mockQuote,
  };

  const mockGameGenerator: GameGenerator = {
    generatePuzzle: () => mockPuzzle,
    generateDailyPuzzle: async (_date: DateTime) => mockPuzzle,
  };

  beforeEach(async () => {
    const container = createTestContainer({
      quoteSource: mockQuoteSource,
      gameGenerator: mockGameGenerator,
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

  afterEach(async () => {
    await fastify.close();
  });

  describe("POST /:id/check", () => {
    it("returns 200 with correct: true for correct solution", async () => {
      const gameId = encodeGameId(DateTime.fromISO("2026-02-01", { zone: "utc" }));

      const response = await fastify.inject({
        method: "POST",
        url: `/${gameId}/check`,
        payload: {
          solution: "The quick brown fox jumps over the lazy dog.",
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toEqual({ correct: true });
    });

    it("returns 200 with correct: false for incorrect solution", async () => {
      const gameId = encodeGameId(DateTime.fromISO("2026-02-01", { zone: "utc" }));

      const response = await fastify.inject({
        method: "POST",
        url: `/${gameId}/check`,
        payload: {
          solution: "This is not the correct answer.",
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toEqual({ correct: false });
    });

    it("validates case-insensitively", async () => {
      const gameId = encodeGameId(DateTime.fromISO("2026-02-01", { zone: "utc" }));

      const response = await fastify.inject({
        method: "POST",
        url: `/${gameId}/check`,
        payload: {
          solution: "THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG.",
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toEqual({ correct: true });
    });

    it("normalizes whitespace in solution", async () => {
      const gameId = encodeGameId(DateTime.fromISO("2026-02-01", { zone: "utc" }));

      const response = await fastify.inject({
        method: "POST",
        url: `/${gameId}/check`,
        payload: {
          solution: "The  quick   brown fox jumps  over the lazy dog.",
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toEqual({ correct: true });
    });

    it("returns 404 for invalid game ID", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/invalid-id-12345/check",
        payload: {
          solution: "Some solution",
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("returns 404 for empty game ID", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "//check",
        payload: {
          solution: "Some solution",
        },
      });

      // Empty path segment typically results in 404
      expect(response.statusCode).toBe(404);
    });

    it("returns 400 for missing solution in body", async () => {
      const gameId = encodeGameId(DateTime.fromISO("2026-02-01", { zone: "utc" }));

      const response = await fastify.inject({
        method: "POST",
        url: `/${gameId}/check`,
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 for empty solution string", async () => {
      const gameId = encodeGameId(DateTime.fromISO("2026-02-01", { zone: "utc" }));

      const response = await fastify.inject({
        method: "POST",
        url: `/${gameId}/check`,
        payload: {
          solution: "",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
