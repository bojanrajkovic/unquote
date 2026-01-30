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

  describe("property: hints validity", () => {
    it("every generated hint is a valid entry from the puzzle mapping", () => {
      fc.assert(
        fc.property(cipherMappingArbitrary, fc.integer({ min: 0, max: 26 }), (mapping, count) => {
          const hints = generateHints(mapping, count);

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

    it("hints count never exceeds mapping size", () => {
      fc.assert(
        fc.property(cipherMappingArbitrary, fc.integer({ min: 0, max: 100 }), (mapping, count) => {
          const hints = generateHints(mapping, count);
          return hints.length <= Object.keys(mapping).length;
        }),
      );
    });

    it("no duplicate hints", () => {
      fc.assert(
        fc.property(cipherMappingArbitrary, fc.integer({ min: 0, max: 26 }), (mapping, count) => {
          const hints = generateHints(mapping, count);
          const cipherLetters = hints.map((h) => h.cipherLetter);
          const uniqueCipherLetters = new Set(cipherLetters);
          return cipherLetters.length === uniqueCipherLetters.size;
        }),
      );
    });
  });

  describe("property: determinism", () => {
    it("same mapping and count always produce same hints", () => {
      fc.assert(
        fc.property(cipherMappingArbitrary, fc.integer({ min: 0, max: 26 }), (mapping, count) => {
          const hints1 = generateHints(mapping, count);
          const hints2 = generateHints(mapping, count);

          return JSON.stringify(hints1) === JSON.stringify(hints2);
        }),
      );
    });
  });

  describe("property: edge cases", () => {
    it("handles empty mapping", () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 10 }), (count) => {
          const hints = generateHints({}, count);
          return hints.length === 0;
        }),
      );
    });

    it("handles zero count", () => {
      fc.assert(
        fc.property(cipherMappingArbitrary, (mapping) => {
          const hints = generateHints(mapping, 0);
          return hints.length === 0;
        }),
      );
    });

    it("handles negative count as zero", () => {
      fc.assert(
        fc.property(cipherMappingArbitrary, fc.integer({ max: -1 }), (mapping, count) => {
          const hints = generateHints(mapping, count);
          return hints.length === 0;
        }),
      );
    });
  });
});
