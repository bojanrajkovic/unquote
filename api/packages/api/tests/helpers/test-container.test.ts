import { describe, it, expect } from "vitest";
import {
  createTestContainer,
  createMockQuoteSource,
  createMockGameGenerator,
  defaultTestConfig,
} from "./test-container.js";

describe("createTestContainer", () => {
  describe("with defaults", () => {
    it("should create a container with all dependencies", () => {
      const container = createTestContainer();

      expect(container.cradle.config).toBeDefined();
      expect(container.cradle.logger).toBeDefined();
      expect(container.cradle.quoteSource).toBeDefined();
      expect(container.cradle.gameGenerator).toBeDefined();
    });

    it("should use silent logger by default", () => {
      const container = createTestContainer();

      expect(container.cradle.logger.level).toBe("silent");
    });

    it("should use default test config", () => {
      const container = createTestContainer();

      expect(container.cradle.config.PORT).toBe(defaultTestConfig.PORT);
      expect(container.cradle.config.HOST).toBe(defaultTestConfig.HOST);
    });
  });

  describe("with overrides", () => {
    it("should allow overriding config", () => {
      const container = createTestContainer({
        config: { PORT: 4000 },
      });

      expect(container.cradle.config.PORT).toBe(4000);
      expect(container.cradle.config.HOST).toBe(defaultTestConfig.HOST);
    });

    it("should allow overriding quoteSource", () => {
      const customQuoteSource = createMockQuoteSource();
      const container = createTestContainer({
        quoteSource: customQuoteSource,
      });

      expect(container.cradle.quoteSource).toBe(customQuoteSource);
    });

    it("should allow overriding gameGenerator", () => {
      const customGenerator = createMockGameGenerator();
      const container = createTestContainer({
        gameGenerator: customGenerator,
      });

      expect(container.cradle.gameGenerator).toBe(customGenerator);
    });
  });

  describe("createScope for test isolation", () => {
    it("should create isolated scopes from container", () => {
      const container = createTestContainer();

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      // Scopes are independent
      expect(scope1).not.toBe(scope2);
    });

    it("should allow scope to override dependencies", async () => {
      const container = createTestContainer();
      const scope = container.createScope();

      // Override quoteSource in scope
      const customQuoteSource = createMockQuoteSource();
      scope.register({
        quoteSource: { resolve: () => customQuoteSource },
      });

      // Parent container unchanged
      expect(container.cradle.quoteSource).not.toBe(customQuoteSource);
    });
  });
});

describe("createMockQuoteSource", () => {
  it("should return a quote from getRandomQuote", async () => {
    const source = createMockQuoteSource();
    const quote = await source.getRandomQuote();

    expect(quote).toBeDefined();
    expect(quote.text).toBeDefined();
    expect(quote.author).toBeDefined();
  });

  it("should return quote by id from getQuote", async () => {
    const source = createMockQuoteSource();
    const quote = await source.getQuote("test-quote-1");

    expect(quote).not.toBeNull();
    expect(quote?.id).toBe("test-quote-1");
  });

  it("should return null for unknown id", async () => {
    const source = createMockQuoteSource();
    const quote = await source.getQuote("unknown-id");

    expect(quote).toBeNull();
  });
});

describe("createMockGameGenerator", () => {
  it("should generate a puzzle from a quote", async () => {
    const generator = createMockGameGenerator();
    const quote = {
      id: "test",
      text: "Hello World",
      author: "Test",
      category: "test",
      difficulty: 50,
    };

    const puzzle = await generator.generatePuzzle(quote);

    expect(puzzle).toBeDefined();
    expect(puzzle.encryptedText).toBeDefined();
    expect(puzzle.quoteId).toBeDefined();
    expect(puzzle.mapping).toBeDefined();
    expect(puzzle.hints).toBeDefined();
  });

  it("should generate a daily puzzle", async () => {
    const generator = createMockGameGenerator();
    const { DateTime } = await import("luxon");
    const puzzle = await generator.generateDailyPuzzle(DateTime.fromISO("2026-01-29"));

    expect(puzzle).toBeDefined();
    expect(puzzle.quoteId).toContain("daily");
  });
});
