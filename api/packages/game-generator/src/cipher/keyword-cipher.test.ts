import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DateTime } from "luxon";
import { KeywordCipherGenerator } from "./keyword-cipher.js";
import { InMemoryQuoteSource } from "../quotes/in-memory-source.js";
import type { Quote } from "../types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const quotesPath = join(__dirname, "../../../../resources/quotes.json");

describe("KeywordCipherGenerator", () => {
  let generator: KeywordCipherGenerator;
  let quoteSource: InMemoryQuoteSource;

  beforeAll(async () => {
    const content = await readFile(quotesPath, "utf-8");
    const quotes: Quote[] = JSON.parse(content);
    quoteSource = new InMemoryQuoteSource(quotes);
  });

  beforeEach(() => {
    generator = new KeywordCipherGenerator(quoteSource);
  });

  describe("generatePuzzle", () => {
    const testQuote: Quote = {
      id: "test-1",
      text: "Hello World",
      author: "Test Author",
      category: "test",
      difficulty: 50,
    };

    it("encrypts the quote text", () => {
      const puzzle = generator.generatePuzzle(testQuote, "seed-1");

      expect(puzzle.encryptedText).not.toBe(testQuote.text);
      expect(puzzle.encryptedText.length).toBe(testQuote.text.length);
    });

    it("preserves non-letter characters", () => {
      const quoteWithPunctuation: Quote = {
        ...testQuote,
        text: "Hello, World! How are you?",
      };

      const puzzle = generator.generatePuzzle(quoteWithPunctuation, "seed-1");

      // Check that punctuation and spaces are preserved
      expect(puzzle.encryptedText[5]).toBe(",");
      expect(puzzle.encryptedText[6]).toBe(" ");
      expect(puzzle.encryptedText[12]).toBe("!");
      expect(puzzle.encryptedText[13]).toBe(" ");
    });

    it("returns correct quote ID", () => {
      const puzzle = generator.generatePuzzle(testQuote, "seed-1");

      expect(puzzle.quoteId).toBe("test-1");
    });

    it("provides a cipher mapping", () => {
      const puzzle = generator.generatePuzzle(testQuote, "seed-1");

      expect(puzzle.mapping).toBeDefined();
      expect(Object.keys(puzzle.mapping).length).toBeGreaterThan(0);
    });

    it("produces deterministic output with same seed", () => {
      const puzzle1 = generator.generatePuzzle(testQuote, "same-seed");
      const puzzle2 = generator.generatePuzzle(testQuote, "same-seed");

      expect(puzzle1.encryptedText).toBe(puzzle2.encryptedText);
      expect(puzzle1.mapping).toEqual(puzzle2.mapping);
    });

    it("produces different output with different seeds", () => {
      const puzzle1 = generator.generatePuzzle(testQuote, "seed-a");
      const puzzle2 = generator.generatePuzzle(testQuote, "seed-b");

      expect(puzzle1.encryptedText).not.toBe(puzzle2.encryptedText);
    });

    it("includes hints by default", () => {
      const puzzle = generator.generatePuzzle(testQuote, "seed-1");

      expect(puzzle.hints.length).toBe(2);
      expect(puzzle.hints[0]).toHaveProperty("cipherLetter");
      expect(puzzle.hints[0]).toHaveProperty("plainLetter");
    });

    it("can decrypt using the mapping", () => {
      const puzzle = generator.generatePuzzle(testQuote, "seed-1");

      // Build reverse mapping
      const reverseMapping: Record<string, string> = {};
      for (const [plain, cipher] of Object.entries(puzzle.mapping)) {
        reverseMapping[cipher] = plain;
      }

      // Decrypt
      const decrypted = [...puzzle.encryptedText]
        .map((char) => {
          if (char in reverseMapping) {
            return reverseMapping[char];
          }
          return char;
        })
        .join("");

      expect(decrypted.toLowerCase()).toBe(testQuote.text.toLowerCase());
    });
  });

  describe("generateDailyPuzzle", () => {
    it("returns a puzzle for the given date", async () => {
      const date = DateTime.fromISO("2026-01-29");
      const puzzle = await generator.generateDailyPuzzle(date);

      expect(puzzle).toBeDefined();
      expect(puzzle.encryptedText).toBeDefined();
      expect(puzzle.quoteId).toBeDefined();
    });

    it("returns same puzzle for same date", async () => {
      const date1 = DateTime.fromISO("2026-01-29");
      const date2 = DateTime.fromISO("2026-01-29");

      const puzzle1 = await generator.generateDailyPuzzle(date1);
      const puzzle2 = await generator.generateDailyPuzzle(date2);

      expect(puzzle1.encryptedText).toBe(puzzle2.encryptedText);
      expect(puzzle1.quoteId).toBe(puzzle2.quoteId);
    });

    it("returns different puzzle for different dates", async () => {
      const date1 = DateTime.fromISO("2026-01-29");
      const date2 = DateTime.fromISO("2026-01-30");

      const puzzle1 = await generator.generateDailyPuzzle(date1);
      const puzzle2 = await generator.generateDailyPuzzle(date2);

      // Different dates should produce different puzzles
      // (either different quote or different cipher, or both)
      const samePuzzle = puzzle1.encryptedText === puzzle2.encryptedText && puzzle1.quoteId === puzzle2.quoteId;
      expect(samePuzzle).toBe(false);
    });
  });
});
