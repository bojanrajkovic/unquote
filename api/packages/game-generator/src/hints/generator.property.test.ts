import { describe, it } from "vitest";
import fc from "fast-check";
import { generateHints } from "./generator.js";
import type { CipherMapping } from "../types.js";

describe("hint generation properties", () => {
  // Arbitrary for CipherMapping (26 lowercase letters -> 26 uppercase letters)
  const cipherMappingArbitrary = fc
    .array(
      fc.tuple(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz"), fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ")),
      {
        minLength: 26,
        maxLength: 26,
      },
    )
    .map((_tuples) => {
      const mapping: CipherMapping = {};
      const alphabet = [..."abcdefghijklmnopqrstuvwxyz"];
      const [shuffled] = fc.sample(
        fc.shuffledSubarray([..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"], { minLength: 26, maxLength: 26 }),
        1,
      );

      for (let i = 0; i < 26; i++) {
        mapping[alphabet[i]] = shuffled[i];
      }
      return mapping;
    });

  // Generate a ciphertext that contains all possible cipher letters
  const fullCiphertext = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  // Generate random ciphertext (uppercase letters only)
  const ciphertextArbitrary = fc.string({ minLength: 1, maxLength: 100 }).map((s) =>
    s
      .toUpperCase()
      .split("")
      .filter((c) => /[A-Z]/.test(c))
      .join("") || "ABC",
  );

  describe("property: hints validity", () => {
    it("every generated hint is a valid entry from the puzzle mapping", () => {
      fc.assert(
        fc.property(cipherMappingArbitrary, fc.integer({ min: 0, max: 26 }), (mapping, count) => {
          const hints = generateHints(mapping, fullCiphertext, count);

          for (const hint of hints) {
            // Check that the hint matches the mapping
            if (mapping[hint.plainLetter] !== hint.cipherLetter) {
              return false;
            }
          }

          return true;
        }),
      );
    });

    it("hints count never exceeds unique letters in ciphertext", () => {
      fc.assert(
        fc.property(cipherMappingArbitrary, ciphertextArbitrary, fc.integer({ min: 0, max: 100 }), (mapping, ciphertext, count) => {
          const hints = generateHints(mapping, ciphertext, count);
          const uniqueCiphertextLetters = new Set([...ciphertext].filter((c) => /[A-Z]/.test(c)));
          return hints.length <= uniqueCiphertextLetters.size;
        }),
      );
    });

    it("no duplicate hints", () => {
      fc.assert(
        fc.property(cipherMappingArbitrary, fc.integer({ min: 0, max: 26 }), (mapping, count) => {
          const hints = generateHints(mapping, fullCiphertext, count);
          const cipherLetters = hints.map((h) => h.cipherLetter);
          const uniqueCipherLetters = new Set(cipherLetters);
          return cipherLetters.length === uniqueCipherLetters.size;
        }),
      );
    });

    it("all hint cipher letters appear in ciphertext", () => {
      fc.assert(
        fc.property(cipherMappingArbitrary, ciphertextArbitrary, fc.integer({ min: 1, max: 26 }), (mapping, ciphertext, count) => {
          const hints = generateHints(mapping, ciphertext, count);

          for (const hint of hints) {
            if (!ciphertext.includes(hint.cipherLetter)) {
              return false;
            }
          }

          return true;
        }),
      );
    });
  });

  describe("property: determinism", () => {
    it("same mapping, ciphertext, and count always produce same hints", () => {
      fc.assert(
        fc.property(cipherMappingArbitrary, ciphertextArbitrary, fc.integer({ min: 0, max: 26 }), (mapping, ciphertext, count) => {
          const hints1 = generateHints(mapping, ciphertext, count);
          const hints2 = generateHints(mapping, ciphertext, count);

          return JSON.stringify(hints1) === JSON.stringify(hints2);
        }),
      );
    });
  });

  describe("property: edge cases", () => {
    it("handles empty mapping", () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 10 }), (count) => {
          const hints = generateHints({}, "ABC", count);
          return hints.length === 0;
        }),
      );
    });

    it("handles zero count", () => {
      fc.assert(
        fc.property(cipherMappingArbitrary, ciphertextArbitrary, (mapping, ciphertext) => {
          const hints = generateHints(mapping, ciphertext, 0);
          return hints.length === 0;
        }),
      );
    });

    it("handles negative count as zero", () => {
      fc.assert(
        fc.property(cipherMappingArbitrary, ciphertextArbitrary, fc.integer({ max: -1 }), (mapping, ciphertext, count) => {
          const hints = generateHints(mapping, ciphertext, count);
          return hints.length === 0;
        }),
      );
    });

    it("handles empty ciphertext", () => {
      fc.assert(
        fc.property(cipherMappingArbitrary, fc.integer({ min: 1, max: 10 }), (mapping, count) => {
          const hints = generateHints(mapping, "", count);
          return hints.length === 0;
        }),
      );
    });

    it("handles ciphertext with no letters", () => {
      fc.assert(
        fc.property(cipherMappingArbitrary, fc.integer({ min: 1, max: 10 }), (mapping, count) => {
          const hints = generateHints(mapping, "123 !@#", count);
          return hints.length === 0;
        }),
      );
    });
  });
});
