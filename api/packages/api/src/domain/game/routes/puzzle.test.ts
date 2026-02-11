import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import sensible from "@fastify/sensible";
import { oas3PluginAjv } from "@eropple/fastify-openapi3";
import type { GameGenerator, Puzzle, Quote } from "@unquote/game-generator";
import type { DateTime } from "luxon";

import { registerDependencyInjection } from "../../../deps/index.js";
import { InMemoryQuoteSource } from "@unquote/game-generator";
import { createTestContainer, createSilentLogger } from "../../../../tests/helpers/index.js";
import { puzzleRoutes } from "./puzzle.js";

describe("puzzle routes", () => {
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
    mapping: { a: "N", b: "O", c: "P" }, // This should NOT appear in response
    hints: [
      { cipherLetter: "G", plainLetter: "t" },
      { cipherLetter: "Q", plainLetter: "u" },
    ],
  };

  const mockQuoteSource = new InMemoryQuoteSource([mockQuote]);

  const mockGameGenerator: GameGenerator = {
    generatePuzzle: async () => mockPuzzle,
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
    await fastify.register(puzzleRoutes);
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe("GET /today", () => {
    it("returns 200 with puzzle data", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/today",
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty("id");
      expect(body).toHaveProperty("date");
      expect(body).toHaveProperty("encryptedText");
      expect(body).toHaveProperty("author");
      expect(body).toHaveProperty("difficulty");
      expect(body).toHaveProperty("hints");
    });

    it("returns encrypted text from puzzle", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/today",
      });

      const body = response.json();
      expect(body.encryptedText).toBe(mockPuzzle.encryptedText);
    });

    it("returns author from quote", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/today",
      });

      const body = response.json();
      expect(body.author).toBe(mockQuote.author);
    });

    it("returns difficulty from quote", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/today",
      });

      const body = response.json();
      expect(body.difficulty).toBe(mockQuote.difficulty);
    });

    it("returns hints normalized to uppercase", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/today",
      });

      const body = response.json();
      expect(body.hints).toHaveLength(2);
      expect(body.hints[0].cipherLetter).toBe("G");
      expect(body.hints[0].plainLetter).toBe("T"); // Normalized to uppercase
      expect(body.hints[1].cipherLetter).toBe("Q");
      expect(body.hints[1].plainLetter).toBe("U");
    });

    it("does NOT expose cipher mapping in response", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/today",
      });

      const body = response.json();
      expect(body).not.toHaveProperty("mapping");
      expect(body).not.toHaveProperty("cipherMapping");
    });

    it("returns a valid game ID", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/today",
      });

      const body = response.json();
      expect(body.id).toBeTruthy();
      expect(typeof body.id).toBe("string");
      expect(body.id.length).toBeGreaterThanOrEqual(8);
    });

    it("returns date in ISO format", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/today",
      });

      const body = response.json();
      expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("GET /game/:date", () => {
    it("returns 200 with puzzle data for valid date", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/2026-02-01",
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty("id");
      expect(body).toHaveProperty("date", "2026-02-01");
      expect(body).toHaveProperty("encryptedText");
      expect(body).toHaveProperty("author");
      expect(body).toHaveProperty("difficulty");
      expect(body).toHaveProperty("hints");
    });

    it("returns the requested date in response", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/2025-12-25",
      });

      const body = response.json();
      expect(body.date).toBe("2025-12-25");
    });

    it("returns 404 for URL with different path structure", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/2026/02/01",
      });

      // Route doesn't match /:date pattern, so 404
      expect(response.statusCode).toBe(404);
    });

    it("returns 400 for invalid date format - not a date", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/not-a-date",
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 for invalid date - February 30", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/2026-02-30",
      });

      expect(response.statusCode).toBe(400);
    });

    it("accepts valid leap year date", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/2024-02-29",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.date).toBe("2024-02-29");
    });

    it("returns different game IDs for different dates", async () => {
      const response1 = await fastify.inject({
        method: "GET",
        url: "/2026-02-01",
      });
      const response2 = await fastify.inject({
        method: "GET",
        url: "/2026-02-02",
      });

      const body1 = response1.json();
      const body2 = response2.json();

      expect(body1.id).not.toBe(body2.id);
    });

    it("does NOT expose cipher mapping in response", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/2026-02-01",
      });

      const body = response.json();
      expect(body).not.toHaveProperty("mapping");
      expect(body).not.toHaveProperty("cipherMapping");
    });
  });
});
