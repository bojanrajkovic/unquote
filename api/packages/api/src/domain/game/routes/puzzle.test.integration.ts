import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import sensible from "@fastify/sensible";
import { oas3PluginAjv } from "@eropple/fastify-openapi3";
import { KeywordCipherGenerator, KEYWORDS, type KeywordSource } from "@unquote/game-generator";
import { JsonQuoteSource } from "../../../sources/json-quote-source.js";

import { registerDependencyInjection } from "../../../deps/index.js";
import { createTestContainer, createSilentLogger, getTestQuotesPath } from "../../../../tests/helpers/index.js";
import { puzzleRoutes } from "./puzzle.js";

/**
 * Integration tests for puzzle routes.
 * Uses real gameGenerator and quoteSource implementations with test data.
 */
describe("puzzle routes integration", () => {
  let fastify: FastifyInstance;

  beforeAll(async () => {
    // arrange (shared): real quote source + game generator with test data
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
    await fastify.register(puzzleRoutes);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it("GET /today returns a puzzle with valid structure", async () => {
    // act
    const response = await fastify.inject({
      method: "GET",
      url: "/today",
    });

    // assert
    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("date");
    expect(body).toHaveProperty("encryptedText");
    expect(body).toHaveProperty("author");
    expect(body).toHaveProperty("difficulty");
    expect(body).toHaveProperty("hints");

    expect(typeof body.id).toBe("string");
    expect(typeof body.date).toBe("string");
    expect(typeof body.encryptedText).toBe("string");
    expect(typeof body.author).toBe("string");
    expect(typeof body.difficulty).toBe("number");
    expect(Array.isArray(body.hints)).toBe(true);

    for (const hint of body.hints) {
      expect(hint).toHaveProperty("cipherLetter");
      expect(hint).toHaveProperty("plainLetter");
      expect(hint.cipherLetter).toMatch(/^[A-Z]$/);
      expect(hint.plainLetter).toMatch(/^[A-Z]$/);
    }

    expect(body).not.toHaveProperty("mapping");
    expect(body).not.toHaveProperty("cipherMapping");
  });

  it("GET /today returns same puzzle on repeated calls (deterministic)", async () => {
    // act
    const response1 = await fastify.inject({ method: "GET", url: "/today" });
    const response2 = await fastify.inject({ method: "GET", url: "/today" });

    // assert
    const body1 = response1.json();
    const body2 = response2.json();

    expect(body1.id).toBe(body2.id);
    expect(body1.encryptedText).toBe(body2.encryptedText);
    expect(body1.author).toBe(body2.author);
  });

  it("GET /:date returns puzzle for valid past date", async () => {
    // act
    const response = await fastify.inject({
      method: "GET",
      url: "/2020-01-01",
    });

    // assert
    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.date).toBe("2020-01-01");
    expect(body.encryptedText).toBeTruthy();
  });

  it("GET /:date returns different puzzles for different dates", async () => {
    // act
    const response1 = await fastify.inject({ method: "GET", url: "/2020-01-01" });
    const response2 = await fastify.inject({ method: "GET", url: "/2020-01-02" });

    // assert
    const body1 = response1.json();
    const body2 = response2.json();

    expect(body1.id).not.toBe(body2.id);
  });

  it("GET /:date returns same puzzle for same date (deterministic)", async () => {
    // act
    const response1 = await fastify.inject({ method: "GET", url: "/2020-06-15" });
    const response2 = await fastify.inject({ method: "GET", url: "/2020-06-15" });

    // assert
    const body1 = response1.json();
    const body2 = response2.json();

    expect(body1.id).toBe(body2.id);
    expect(body1.encryptedText).toBe(body2.encryptedText);
  });
});
