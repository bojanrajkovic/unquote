import { describe, it } from "vitest";
import fc from "fast-check";
import { KeywordCipherGenerator } from "./keyword-cipher.js";
import type { KeywordSource } from "./types.js";
import { InMemoryQuoteSource } from "../quotes/in-memory-source.js";
import { KEYWORDS } from "../data/keywords.js";
import type { Quote } from "../types.js";

describe("cipher properties", () => {
  // The quoteSource is only needed for constructor — generatePuzzle
  // takes a Quote directly and never calls quoteSource methods.
  const quoteSource = new InMemoryQuoteSource([]);
  const keywordSource: KeywordSource = { getKeywords: async () => KEYWORDS };
  const generator = new KeywordCipherGenerator(quoteSource, keywordSource);

  // Arbitrary for Quote
  const quoteArbitrary = fc.record({
    id: fc.string({ minLength: 1 }),
    text: fc.string({ minLength: 1, maxLength: 200 }),
    author: fc.string({ minLength: 1 }),
    category: fc.string({ minLength: 1 }),
    difficulty: fc.integer({ min: 0, max: 100 }),
  });

  describe("property: cipher roundtrip", () => {
    it("encrypt then decrypt with reverse mapping recovers original (case-insensitive)", async () => {
      await fc.assert(
        fc.asyncProperty(quoteArbitrary, fc.string(), async (quote, seed) => {
          const puzzle = await generator.generatePuzzle(quote, seed);

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

          // Normalize both for comparison (case-insensitive, whitespace-normalized)
          const normalizedDecrypted = decrypted.toLowerCase().replaceAll(/\s+/g, " ").trim();
          const normalizedOriginal = quote.text.toLowerCase().replaceAll(/\s+/g, " ").trim();

          return normalizedDecrypted === normalizedOriginal;
        }),
      );
    });
  });

  describe("property: cipher mapping bijectivity", () => {
    it("every mapping has exactly 26 unique keys mapping to 26 unique values", async () => {
      await fc.assert(
        fc.asyncProperty(quoteArbitrary, fc.string(), async (quote, seed) => {
          const puzzle = await generator.generatePuzzle(quote, seed);

          // Check 26 keys
          const keys = Object.keys(puzzle.mapping);
          if (keys.length !== 26) {
            return false;
          }

          // Check all values are unique
          const values = Object.values(puzzle.mapping);
          const uniqueValues = new Set(values);
          if (uniqueValues.size !== 26) {
            return false;
          }

          // Check all keys are lowercase a-z
          for (const key of keys) {
            if (!/^[a-z]$/.test(key)) {
              return false;
            }
          }

          // Check all values are uppercase A-Z
          for (const value of values) {
            if (!/^[A-Z]$/.test(value)) {
              return false;
            }
          }

          return true;
        }),
      );
    });

    it("mapping is invertible (bijection)", async () => {
      await fc.assert(
        fc.asyncProperty(quoteArbitrary, fc.string(), async (quote, seed) => {
          const puzzle = await generator.generatePuzzle(quote, seed);

          // Build reverse mapping
          const reverseMapping: Record<string, string> = {};
          for (const [plain, cipher] of Object.entries(puzzle.mapping)) {
            // Check no duplicate cipher letters (would break bijectivity)
            if (cipher in reverseMapping) {
              return false;
            }
            reverseMapping[cipher] = plain;
          }

          // Check reverse mapping is also complete
          return Object.keys(reverseMapping).length === 26;
        }),
      );
    });
  });

  describe("property: non-letter preservation", () => {
    it("punctuation and spaces unchanged after encryption", async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 1, maxLength: 100 }), fc.string(), async (text, seed) => {
          const quote: Quote = {
            id: "test",
            text,
            author: "Test",
            category: "test",
            difficulty: 50,
          };

          const puzzle = await generator.generatePuzzle(quote, seed);

          // Extract non-letter characters from both
          const originalNonLetters = text.replaceAll(/[a-zA-Z]/g, "");
          const encryptedNonLetters = puzzle.encryptedText.replaceAll(/[a-zA-Z]/g, "");

          return originalNonLetters === encryptedNonLetters;
        }),
      );
    });

    it("encrypted text has same length as original", async () => {
      await fc.assert(
        fc.asyncProperty(quoteArbitrary, fc.string(), async (quote, seed) => {
          const puzzle = await generator.generatePuzzle(quote, seed);
          return puzzle.encryptedText.length === quote.text.length;
        }),
      );
    });
  });

  describe("property: no self-mapping", () => {
    it("no plaintext letter ever maps to itself", async () => {
      await fc.assert(
        fc.asyncProperty(quoteArbitrary, fc.string(), async (quote, seed) => {
          const puzzle = await generator.generatePuzzle(quote, seed);

          for (const [plain, cipher] of Object.entries(puzzle.mapping)) {
            if (plain === cipher.toLowerCase()) {
              return false;
            }
          }

          return true;
        }),
      );
    });
  });

  describe("property: determinism", () => {
    it("same seed always produces identical puzzle", async () => {
      await fc.assert(
        fc.asyncProperty(quoteArbitrary, fc.string(), async (quote, seed) => {
          const puzzle1 = await generator.generatePuzzle(quote, seed);
          const puzzle2 = await generator.generatePuzzle(quote, seed);

          return (
            puzzle1.encryptedText === puzzle2.encryptedText &&
            JSON.stringify(puzzle1.mapping) === JSON.stringify(puzzle2.mapping) &&
            JSON.stringify(puzzle1.hints) === JSON.stringify(puzzle2.hints)
          );
        }),
      );
    });
  });
});
