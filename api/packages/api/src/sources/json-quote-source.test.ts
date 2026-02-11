import { dirname, join } from "node:path";
import { readFile, writeFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Quote } from "@unquote/game-generator";
import { JsonQuoteSource } from "./json-quote-source.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const quotesPath = join(__dirname, "../../../../resources/quotes.json");

describe("JsonQuoteSource", () => {
  let source: JsonQuoteSource;
  let firstQuoteId: string;
  let secondQuoteId: string;

  beforeAll(async () => {
    source = new JsonQuoteSource(quotesPath);
    const content = await readFile(quotesPath, "utf8");
    const quotes: Quote[] = JSON.parse(content);
    firstQuoteId = quotes[0]?.id ?? "";
    secondQuoteId = quotes[1]?.id ?? "";
  });

  describe("constructor and validation", () => {
    it("throws error for non-existent file", async () => {
      const badSource = new JsonQuoteSource("/nonexistent/path/quotes.json");

      await expect(badSource.getQuote("any-id")).rejects.toThrow("Quote file not found or not readable");
    });

    it("includes file path in error message", async () => {
      const badPath = "/some/bad/path.json";
      const badSource = new JsonQuoteSource(badPath);

      await expect(badSource.getQuote("any-id")).rejects.toThrow(badPath);
    });
  });

  describe("getQuote", () => {
    it("returns quote when found by id", async () => {
      const quote = await source.getQuote(firstQuoteId);

      expect(quote).not.toBeNull();
      expect(quote?.id).toBe(firstQuoteId);
      expect(quote?.author).toBe("Steve Jobs");
    });

    it("returns null when quote not found", async () => {
      const quote = await source.getQuote("nonexistent-id");

      expect(quote).toBeNull();
    });
  });

  describe("getRandomQuote", () => {
    it("returns a quote", async () => {
      const quote = await source.getRandomQuote();

      expect(quote).toBeDefined();
      expect(quote.id).toBeDefined();
      expect(quote.text).toBeDefined();
      expect(quote.author).toBeDefined();
    });

    it("returns deterministic quote when seeded", async () => {
      const quote1 = await source.getRandomQuote("2026-01-29");
      const quote2 = await source.getRandomQuote("2026-01-29");

      expect(quote1.id).toBe(quote2.id);
    });

    it("returns different quotes for different seeds", async () => {
      // Use seeds that are verified to produce different indices for 52 quotes
      // Hash("seed-alpha") % 52 !== Hash("seed-omega") % 52
      const quote1 = await source.getRandomQuote("seed-alpha");
      const quote2 = await source.getRandomQuote("seed-omega");

      // Verify the seeds produce different quotes
      expect(quote1.id).not.toBe(quote2.id);
    });
  });

  describe("caching", () => {
    it("returns consistent results across multiple calls", async () => {
      const freshSource = new JsonQuoteSource(quotesPath);

      // Multiple calls should return consistent results
      const quote1 = await freshSource.getQuote(firstQuoteId);
      const quote2 = await freshSource.getQuote(firstQuoteId);
      const quote3 = await freshSource.getQuote(secondQuoteId);

      // Same ID should return same object
      expect(quote1).toEqual(quote2);
      expect(quote1?.id).toBe(firstQuoteId);
      expect(quote3?.id).toBe(secondQuoteId);
    });

    it("seeds produce consistent random selections", async () => {
      const freshSource = new JsonQuoteSource(quotesPath);

      // Multiple calls with same seed should return same quote
      const random1a = await freshSource.getRandomQuote("consistent-seed");
      const random1b = await freshSource.getRandomQuote("consistent-seed");
      const random2 = await freshSource.getRandomQuote("different-seed");

      expect(random1a.id).toBe(random1b.id);
      // Different seeds very likely produce different quotes
      expect(random2.id).not.toBe(random1a.id);
    });
  });

  describe("ensureLoaded", () => {
    it("succeeds with valid quotes file", async () => {
      const freshSource = new JsonQuoteSource(quotesPath);
      // Should not throw
      await expect(freshSource.ensureLoaded()).resolves.toBeUndefined();
    });

    it("throws with missing file", async () => {
      const badSource = new JsonQuoteSource("/nonexistent/path/quotes.json");
      await expect(badSource.ensureLoaded()).rejects.toThrow("Quote file not found or not readable");
    });

    it("throws with invalid JSON file", async () => {
      let tempDir: string;
      const tempFiles: string[] = [];

      tempDir = await mkdtemp(join(tmpdir(), "quote-test-"));

      async function createTempQuoteFile(content: unknown): Promise<string> {
        const filePath = join(tempDir, `quotes-${Date.now()}.json`);
        await writeFile(filePath, JSON.stringify(content));
        tempFiles.push(filePath);
        return filePath;
      }

      const filePath = await createTempQuoteFile({ not: "an array" });
      const badSource = new JsonQuoteSource(filePath);

      await expect(badSource.ensureLoaded()).rejects.toThrow("Invalid quotes format");

      // Cleanup
      for (const file of tempFiles) {
        try {
          await unlink(file);
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe("validation errors", () => {
    let tempDir: string;
    const tempFiles: string[] = [];

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), "quote-test-"));
    });

    afterAll(async () => {
      for (const file of tempFiles) {
        try {
          await unlink(file);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    async function createTempQuoteFile(content: unknown): Promise<string> {
      const filePath = join(tempDir, `quotes-${Date.now()}.json`);
      await writeFile(filePath, JSON.stringify(content));
      tempFiles.push(filePath);
      return filePath;
    }

    it("rejects non-array input", async () => {
      const filePath = await createTempQuoteFile({ not: "an array" });
      const badSource = new JsonQuoteSource(filePath);

      await expect(badSource.getQuote("any")).rejects.toThrow("Invalid quotes format");
    });

    it("rejects quote with missing required field", async () => {
      const filePath = await createTempQuoteFile([
        {
          id: "test-1",
          text: "Some text",
          author: "Author",
          // missing category and difficulty
        },
      ]);
      const badSource = new JsonQuoteSource(filePath);

      await expect(badSource.getQuote("test-1")).rejects.toThrow("Invalid quotes format");
    });

    it("rejects quote with wrong type for difficulty", async () => {
      const filePath = await createTempQuoteFile([
        {
          id: "test-1",
          text: "Some text",
          author: "Author",
          category: "test",
          difficulty: "not a number",
        },
      ]);
      const badSource = new JsonQuoteSource(filePath);

      await expect(badSource.getQuote("test-1")).rejects.toThrow("Invalid quotes format");
    });

    it("rejects quote with difficulty out of range", async () => {
      const filePath = await createTempQuoteFile([
        {
          id: "test-1",
          text: "Some text",
          author: "Author",
          category: "test",
          difficulty: 150, // Out of range (max 100)
        },
      ]);
      const badSource = new JsonQuoteSource(filePath);

      await expect(badSource.getQuote("test-1")).rejects.toThrow("Invalid quotes format");
    });

    it("rejects quote with empty string id", async () => {
      const filePath = await createTempQuoteFile([
        {
          id: "", // Empty string violates minLength: 1
          text: "Some text",
          author: "Author",
          category: "test",
          difficulty: 50,
        },
      ]);
      const badSource = new JsonQuoteSource(filePath);

      await expect(badSource.getQuote("")).rejects.toThrow("Invalid quotes format");
    });
  });
});
