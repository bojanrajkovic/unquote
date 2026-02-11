import { dirname, join } from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DateTime } from "luxon";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Quote } from "./types.js";
import { KeywordCipherGenerator } from "./cipher/keyword-cipher.js";
import { InMemoryQuoteSource } from "./quotes/in-memory-source.js";
import { validateSolution } from "./validation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const quotesPath = join(__dirname, "../../../resources/quotes.json");

describe("Integration Tests", () => {
  let quoteSource: InMemoryQuoteSource;
  let generator: KeywordCipherGenerator;
  let allQuotes: Quote[];

  beforeAll(async () => {
    const content = await readFile(quotesPath, "utf8");
    allQuotes = JSON.parse(content);
    quoteSource = new InMemoryQuoteSource(allQuotes);
  });

  beforeEach(() => {
    generator = new KeywordCipherGenerator(quoteSource);
  });

  describe("end-to-end puzzle flow", () => {
    it("generates puzzle that can be solved", async () => {
      // Get a quote
      const quote = await quoteSource.getRandomQuote("test-seed");

      // Generate puzzle
      const puzzle = generator.generatePuzzle(quote, "test-seed");

      // Decrypt using the mapping
      const reverseMapping: Record<string, string> = {};
      for (const [plain, cipher] of Object.entries(puzzle.mapping)) {
        reverseMapping[cipher] = plain;
      }

      const decrypted = [...puzzle.encryptedText]
        .map((char) => {
          if (char in reverseMapping) {
            return reverseMapping[char];
          }
          return char;
        })
        .join("");

      // Validate the solution
      const isValid = validateSolution(decrypted, quote.text);
      expect(isValid).toBe(true);
    });

    it("validates correct solution submission", async () => {
      const quote = allQuotes[0]!;

      // Simulate player typing the correct answer
      const isValid = validateSolution(quote.text, quote.text);
      expect(isValid).toBe(true);
    });

    it("rejects incorrect solution submission", async () => {
      const quote = allQuotes[0]!;

      // Simulate player typing wrong answer
      const isValid = validateSolution("Wrong answer entirely", quote.text);
      expect(isValid).toBe(false);
    });
  });

  describe("daily puzzle determinism", () => {
    it("generates same puzzle for same date", async () => {
      const date = DateTime.fromISO("2026-01-29");

      const puzzle1 = await generator.generateDailyPuzzle(date);
      const puzzle2 = await generator.generateDailyPuzzle(date);

      expect(puzzle1.quoteId).toBe(puzzle2.quoteId);
      expect(puzzle1.encryptedText).toBe(puzzle2.encryptedText);
      expect(puzzle1.mapping).toEqual(puzzle2.mapping);
      // Verify hints are also deterministic
      expect(puzzle1.hints).toEqual(puzzle2.hints);
    });

    it("generates different puzzles for different dates", async () => {
      const date1 = DateTime.fromISO("2026-01-29");
      const date2 = DateTime.fromISO("2026-01-30");

      const puzzle1 = await generator.generateDailyPuzzle(date1);
      const puzzle2 = await generator.generateDailyPuzzle(date2);

      // At least one of quoteId or encryptedText should differ
      const isDifferent = puzzle1.quoteId !== puzzle2.quoteId || puzzle1.encryptedText !== puzzle2.encryptedText;
      expect(isDifferent).toBe(true);
    });

    it("generates consistent puzzles across multiple calls", async () => {
      // Test with multiple dates to verify seed consistency
      const dates = [DateTime.fromISO("2026-01-01"), DateTime.fromISO("2026-06-15"), DateTime.fromISO("2026-12-31")];

      const puzzleResults = await Promise.all(
        dates.flatMap((date) => [generator.generateDailyPuzzle(date), generator.generateDailyPuzzle(date)]),
      );

      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      for (let i = 0; i < puzzleResults.length; i += 2) {
        const puzzle1 = puzzleResults[i];
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        const puzzle2 = puzzleResults[i + 1];

        expect(puzzle1!.quoteId).toBe(puzzle2!.quoteId);
        expect(puzzle1!.encryptedText).toBe(puzzle2!.encryptedText);
      }
    });
  });

  describe("cipher roundtrip property", () => {
    it("decryption with mapping recovers original for any quote", async () => {
      // Test a representative sample across the full range (52 quotes)
      // Sample quotes at even intervals across the 52 quotes
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      const sampleQuotes = [
        allQuotes[0],
        allQuotes[4],
        allQuotes[9],
        allQuotes[14],
        allQuotes[19],
        allQuotes[24],
        allQuotes[29],
        allQuotes[34],
        allQuotes[39],
        allQuotes[44],
        allQuotes[49],
        allQuotes[51],
      ];

      for (const quote of sampleQuotes) {
        const puzzle = generator.generatePuzzle(quote!, `seed-${quote!.id}`);

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

        // Verify roundtrip
        expect(validateSolution(decrypted, quote!.text)).toBe(true);
      }
    });

    it("all letters are mapped bijectively", () => {
      const quote = {
        id: "test",
        text: "The quick brown fox jumps over the lazy dog",
        author: "Test",
        category: "test",
        difficulty: 50,
      };

      const puzzle = generator.generatePuzzle(quote, "bijection-test");

      // Check all 26 letters are mapped
      expect(Object.keys(puzzle.mapping).length).toBe(26);

      // Check all values are unique (bijective)
      const cipherLetters = new Set(Object.values(puzzle.mapping));
      expect(cipherLetters.size).toBe(26);
    });
  });

  describe("hints verification", () => {
    it("puzzles include hints", async () => {
      const quote = await quoteSource.getRandomQuote("hint-test");
      const puzzle = generator.generatePuzzle(quote, "hint-test");

      expect(puzzle.hints.length).toBeGreaterThan(0);
    });

    it("hints are valid mappings", async () => {
      const quote = await quoteSource.getRandomQuote("hint-valid");
      const puzzle = generator.generatePuzzle(quote, "hint-valid");

      for (const hint of puzzle.hints) {
        expect(puzzle.mapping[hint.plainLetter]).toBe(hint.cipherLetter);
      }
    });
  });
});
