import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { createSeededRng, hashString, selectFromArray } from "./random.js";

describe("random utilities properties", () => {
  describe("property: seeded RNG determinism", () => {
    it("same seed produces identical sequence", () => {
      fc.assert(
        fc.property(fc.integer(), fc.integer({ min: 1, max: 100 }), (seed, n) => {
          const rng1 = createSeededRng(seed);
          const rng2 = createSeededRng(seed);
          // eslint-disable-next-line no-plusplus
          for (let i = 0; i < n; i += 1) {
            if (rng1() !== rng2()) {return false;}
          }
          return true;
        }),
      );
    });

    it("produces values in [0, 1) range", () => {
      fc.assert(
        fc.property(fc.integer(), fc.integer({ min: 1, max: 100 }), (seed, n) => {
          const rng = createSeededRng(seed);
          // eslint-disable-next-line no-plusplus
          for (let i = 0; i < n; i += 1) {
            const val = rng();
            if (val < 0 || val >= 1) {return false;}
          }
          return true;
        }),
      );
    });

    it("different seeds produce different sequences", () => {
      fc.assert(
        fc.property(fc.integer(), fc.integer(), fc.integer({ min: 10, max: 50 }), (seed1, seed2, n) => {
          // Skip if seeds are the same
          if (seed1 === seed2) {return true;}

          const rng1 = createSeededRng(seed1);
          const rng2 = createSeededRng(seed2);

          let foundDifference = false;
          // eslint-disable-next-line no-plusplus
          for (let i = 0; i < n; i += 1) {
            if (rng1() !== rng2()) {
              foundDifference = true;
              break;
            }
          }
          return foundDifference;
        }),
      );
    });
  });

  describe("property: hash distribution", () => {
    it("produces consistent hash for same input", () => {
      fc.assert(
        fc.property(fc.string(), (str) => {
          const hash1 = hashString(str);
          const hash2 = hashString(str);
          return hash1 === hash2;
        }),
      );
    });

    it("produces different hashes for different strings (no collisions allowed)", () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (str1, str2) => {
          // Skip if strings are identical
          if (str1 === str2) {return true;}

          const hash1 = hashString(str1);
          const hash2 = hashString(str2);

          // With 48-bit SHA-256 hash, collisions are astronomically unlikely
          // and should never occur in any reasonable test run
          return hash1 !== hash2;
        }),
      );
    });

    it("produces safe integers", () => {
      fc.assert(
        fc.property(fc.string(), (str) => {
          const hash = hashString(str);
          return Number.isSafeInteger(hash);
        }),
      );
    });

    it("produces non-negative numbers", () => {
      fc.assert(
        fc.property(fc.string(), (str) => {
          const hash = hashString(str);
          return hash >= 0;
        }),
      );
    });
  });

  describe("property: selectFromArray determinism", () => {
    it("same RNG state produces same selection", () => {
      fc.assert(
        fc.property(
          fc.integer(),
          fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 100 }),
          (seed, array) => {
            const rng1 = createSeededRng(seed);
            const rng2 = createSeededRng(seed);

            const selected1 = selectFromArray(array, rng1);
            const selected2 = selectFromArray(array, rng2);

            return selected1 === selected2;
          },
        ),
      );
    });

    it("always selects an element from the array", () => {
      fc.assert(
        fc.property(
          fc.integer(),
          fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 100 }),
          (seed, array) => {
            const rng = createSeededRng(seed);
            const selected = selectFromArray(array, rng);
            return array.includes(selected);
          },
        ),
      );
    });

    it("throws for empty array", () => {
      fc.assert(
        fc.property(fc.integer(), (seed) => {
          const rng = createSeededRng(seed);
          expect(() => selectFromArray([], rng)).toThrow("Cannot select from empty array");
          return true;
        }),
      );
    });
  });
});
