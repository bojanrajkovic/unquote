import { describe, it, expect } from "vitest";
import type { Quote } from "../types.js";
import { QuoteSource } from "./types.js";
import { InMemoryQuoteSource } from "./in-memory-source.js";

const testQuotes: Quote[] = [
  {
    id: "quote-1",
    text: "First quote text",
    author: "Author One",
    category: "test",
    difficulty: 30,
  },
  {
    id: "quote-2",
    text: "Second quote text",
    author: "Author Two",
    category: "test",
    difficulty: 60,
  },
];

describe("QuoteSource abstract class", () => {
  describe("getQuote", () => {
    it("returns quote when found by id", async () => {
      const source = new InMemoryQuoteSource(testQuotes);
      const quote = await source.getQuote("quote-1");

      expect(quote).not.toBeNull();
      expect(quote?.id).toBe("quote-1");
      expect(quote?.text).toBe("First quote text");
    });

    it("returns null when quote not found", async () => {
      const source = new InMemoryQuoteSource(testQuotes);
      const quote = await source.getQuote("nonexistent");

      expect(quote).toBeNull();
    });

    it("returns null for empty quotes array", async () => {
      const source = new InMemoryQuoteSource([]);
      const quote = await source.getQuote("any-id");

      expect(quote).toBeNull();
    });
  });

  describe("getRandomQuote", () => {
    it("returns a quote from the source", async () => {
      const source = new InMemoryQuoteSource(testQuotes);
      const quote = await source.getRandomQuote();

      expect(testQuotes.some((q) => q.id === quote.id)).toBe(true);
    });

    it("returns deterministic quote when seeded", async () => {
      const source = new InMemoryQuoteSource(testQuotes);
      const quote1 = await source.getRandomQuote("test-seed");
      const quote2 = await source.getRandomQuote("test-seed");

      expect(quote1.id).toBe(quote2.id);
    });

    it("returns different quotes for different seeds", async () => {
      // Use many quotes to make collision extremely unlikely
      const manyQuotes: Quote[] = Array.from({ length: 50 }, (_, i) => ({
        id: `quote-${i}`,
        text: `Quote text number ${i}`,
        author: `Author ${i}`,
        category: "test",
        difficulty: 50,
      }));
      const source = new InMemoryQuoteSource(manyQuotes);

      const quote1 = await source.getRandomQuote("seed-alpha");
      const quote2 = await source.getRandomQuote("seed-omega");

      expect(quote1.id).not.toBe(quote2.id);
    });

    it("throws for empty quotes array", async () => {
      const source = new InMemoryQuoteSource([]);

      await expect(source.getRandomQuote()).rejects.toThrow("No quotes available");
    });

    it("throws for empty quotes array with seed", async () => {
      const source = new InMemoryQuoteSource([]);

      await expect(source.getRandomQuote("any-seed")).rejects.toThrow("No quotes available");
    });

    it("returns the only quote when array has one element", async () => {
      const single: Quote[] = [testQuotes[0]!];
      const source = new InMemoryQuoteSource(single);

      const quote = await source.getRandomQuote("any-seed");
      expect(quote.id).toBe("quote-1");
    });
  });

  describe("ensureLoaded", () => {
    it("resolves successfully when quotes are available", async () => {
      const source = new InMemoryQuoteSource(testQuotes);

      await expect(source.ensureLoaded()).resolves.toBeUndefined();
    });

    it("propagates errors from getAllQuotes for fail-fast validation", async () => {
      class FailingQuoteSource extends QuoteSource {
        async getAllQuotes(): Promise<Quote[]> {
          throw new Error("data source unavailable");
        }
      }

      const source = new FailingQuoteSource();

      await expect(source.ensureLoaded()).rejects.toThrow("data source unavailable");
    });
  });
});
