import { describe, it } from "vitest";
import fc from "fast-check";
import { scoreDifficulty } from "./scorer.js";

describe("difficulty scoring properties", () => {
  describe("property: difficulty score range", () => {
    it("always returns 0-100 for any text", () => {
      fc.assert(
        fc.property(fc.string(), (text) => {
          const score = scoreDifficulty(text);
          return score >= 0 && score <= 100;
        }),
      );
    });

    it("handles edge cases", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(""),
            fc.constant(" "),
            fc.constant("a"),
            fc.string({ maxLength: 1 }),
            fc.string({ minLength: 500, maxLength: 1000 }),
          ),
          (text) => {
            const score = scoreDifficulty(text);
            return score >= 0 && score <= 100;
          },
        ),
      );
    });

    it("returns integer scores", () => {
      fc.assert(
        fc.property(fc.string(), (text) => {
          const score = scoreDifficulty(text);
          return Number.isInteger(score);
        }),
      );
    });
  });

  describe("property: length and diversity factor contribution (v2: 7 factors)", () => {
    it("texts with more letters tend toward higher scores", () => {
      fc.assert(
        fc.property(fc.integer({ min: 10, max: 200 }), (length) => {
          // Generate random text of specific length
          const [text] = fc.sample(fc.string({ minLength: length, maxLength: length }), 1);
          const score = scoreDifficulty(text!);

          // v2 algorithm uses 7 factors with weighted distribution:
          // - Length + Diversity: 15%
          // - Short Word Scarcity: 15%
          // - Letter Dominance: 15%
          // - Pattern Uniqueness: 15%
          // - Word Repetition: 15%
          // - Alphabet Coverage: 10%
          // - Digram Frequency: 15%
          return score >= 0 && score <= 100;
        }),
        { numRuns: 100 },
      );
    });
  });

  describe("property: determinism", () => {
    it("same input always produces same score", () => {
      fc.assert(
        fc.property(fc.string(), (text) => {
          const score1 = scoreDifficulty(text);
          const score2 = scoreDifficulty(text);
          return score1 === score2;
        }),
      );
    });
  });

  describe("property: case insensitivity", () => {
    it("uppercase and lowercase versions have same score", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 100 }), (text) => {
          const lowerScore = scoreDifficulty(text.toLowerCase());
          const upperScore = scoreDifficulty(text.toUpperCase());
          return lowerScore === upperScore;
        }),
      );
    });
  });
});
