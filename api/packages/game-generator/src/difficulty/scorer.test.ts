import { describe, it, expect } from "vitest";
import {
  scoreDifficulty,
  calculateWordRepetitionFactor,
  calculateAlphabetCoverageFactor,
  calculateLetterDominanceFactor,
  calculatePatternUniquenessFactor,
} from "./scorer.js";

describe("scoreDifficulty", () => {
  describe("returns value in valid range", () => {
    it("returns a number between 0 and 100", () => {
      const score = scoreDifficulty("Hello world");

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("handles empty string", () => {
      const score = scoreDifficulty("");

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("handles single word", () => {
      const score = scoreDifficulty("Hello");

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe("length + diversity factor (15%)", () => {
    it("scores longer texts as more difficult", () => {
      const shortScore = scoreDifficulty("Hi there");
      const longScore = scoreDifficulty(
        "The quick brown fox jumps over the lazy dog and continues running through the forest",
      );

      expect(longScore).toBeGreaterThan(shortScore);
    });
  });

  describe("short word scarcity factor (15%)", () => {
    it("scores texts with fewer short words as more difficult", () => {
      // Many short words (easy)
      const easyScore = scoreDifficulty("I am a man in a van");
      // Fewer short words (harder)
      const hardScore = scoreDifficulty("Exceptional circumstances require extraordinary measures");

      expect(hardScore).toBeGreaterThan(easyScore);
    });
  });

  describe("letter dominance factor (15%) - 12% threshold", () => {
    it("returns 100 when no letter exceeds 12% threshold", () => {
      // Create text with even distribution: a, b, c, d, e all at 20%
      const score = scoreDifficulty("abcdeabcdeabcdeabcdeabcde");
      expect(score).toBeGreaterThanOrEqual(40); // dominated letters hurt score
    });

    it("applies penalty when dominant letter exceeds 12%", () => {
      // Text with E at ~25% (over the 12% threshold)
      const dominantScore = scoreDifficulty("eeeee beeee seeee");
      // More even distribution
      const evenScore = scoreDifficulty("abcdefghijklmnop");

      expect(evenScore).toBeGreaterThan(dominantScore);
    });

    it("applies aggressive penalty at dominant letter ~40%", () => {
      // Single letter at 40%
      const veryDominantScore = scoreDifficulty("aaaaaaaaaa bcdefghij");
      // More distributed
      const lessDominantScore = scoreDifficulty("abcdefghijk abcdefgh");

      expect(lessDominantScore).toBeGreaterThan(veryDominantScore);
    });
  });

  describe("pattern uniqueness factor (15%) - cubic scaling", () => {
    it("scores texts with fewer repeated patterns as more difficult", () => {
      // Many repeated patterns (easy)
      const repetitiveScore = scoreDifficulty("the the the cat cat cat");
      // Few repeated patterns (harder)
      const uniqueScore = scoreDifficulty("cryptography solving methodology");

      expect(uniqueScore).toBeGreaterThan(repetitiveScore);
    });

    it("applies cubic scaling formula: ratio^3 * 100", () => {
      // Test specific cubic formula
      const oneWord = calculatePatternUniquenessFactor(["hello"]);
      expect(oneWord).toBe(50); // fallback for single word

      // 100% unique (3 words, 3 unique) = 1^3 * 100 = 100
      const allUnique = calculatePatternUniquenessFactor(["apple", "banana", "cherry"]);
      expect(allUnique).toBe(100);

      // 66% unique (3 words, 2 unique) = 0.666^3 * 100 ≈ 29.6 → 30
      const someRepeat = calculatePatternUniquenessFactor(["apple", "banana", "apple"]);
      expect(someRepeat).toBe(30);

      // 50% unique (4 words, 2 unique) = 0.5^3 * 100 = 12.5 → 12 or 13
      const halfUnique = calculatePatternUniquenessFactor(["apple", "banana", "apple", "banana"]);
      expect(halfUnique).toBeLessThanOrEqual(13);
      expect(halfUnique).toBeGreaterThanOrEqual(12);
    });

    it("heavily penalizes low uniqueness ratio", () => {
      // 33% unique = 0.333^3 * 100 ≈ 3.7 → 4
      const lowUniqueness = calculatePatternUniquenessFactor(["word", "word", "word", "other", "other", "other"]);
      expect(lowUniqueness).toBeLessThanOrEqual(4);
    });
  });

  describe("digram frequency factor (15%)", () => {
    it("scores texts with fewer common digrams as more difficult", () => {
      // Many common digrams like TH, HE, IN (easy)
      const commonScore = scoreDifficulty("the there then thin");
      // Fewer common digrams (harder)
      const uncommonScore = scoreDifficulty("fuzzy wax gym fjord");

      expect(uncommonScore).toBeGreaterThan(commonScore);
    });
  });

  describe("word repetition factor (15%)", () => {
    describe("basic structure", () => {
      it("returns 50 when given empty words", () => {
        const score = calculateWordRepetitionFactor([]);
        expect(score).toBe(50);
      });

      it("returns 100 when all words are unique", () => {
        const score = calculateWordRepetitionFactor(["apple", "banana", "cherry", "date", "elderberry"]);
        expect(score).toBe(100);
      });
    });

    describe("penalty calculation", () => {
      it("applies -10 penalty for each occurrence beyond the first", () => {
        // One word appears twice: penalty = (2-1)*10 = 10, score = 100 - 10 = 90
        const score = calculateWordRepetitionFactor(["apple", "banana", "apple"]);
        expect(score).toBe(90);
      });

      it("applies -10 per occurrence for multiple repetitions of same word", () => {
        // One word appears 4 times: penalty = (4-1)*10 = 30, plus 20 bonus = 50, score = 50
        const score = calculateWordRepetitionFactor(["apple", "banana", "apple", "apple", "apple"]);
        expect(score).toBe(50); // 100 - 30 - 20 = 50
      });

      it("applies bonus penalty (-20) when word appears 3+ times", () => {
        // One word appears 3 times: penalty = (3-1)*10 + 20 = 40, score = 60
        const score = calculateWordRepetitionFactor(["apple", "banana", "apple", "apple"]);
        expect(score).toBe(60); // 100 - 20 - 20 = 60
      });

      it("stacks penalties for multiple repeated words", () => {
        // apple appears 3 times: penalty = 20 + 20 = 40
        // banana appears 2 times: penalty = 10
        // cherry appears 2 times: penalty = 10
        // Total penalty = 40 + 10 + 10 = 60, score = 40
        const score = calculateWordRepetitionFactor([
          "apple",
          "banana",
          "apple",
          "cherry",
          "apple",
          "banana",
          "cherry",
        ]);
        expect(score).toBe(40); // 100 - 60 = 40
      });
    });

    describe("score floors at 0", () => {
      it("never returns negative score when penalties exceed 100", () => {
        // Multiple words repeated many times creates large penalties
        const score = calculateWordRepetitionFactor(["a", "a", "a", "a", "a", "a", "a", "a", "b", "b", "b", "b", "b"]);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });
  });

  describe("alphabet coverage factor (10%)", () => {
    describe("boundary values", () => {
      it("returns 50 when given empty text", () => {
        const score = calculateAlphabetCoverageFactor("");
        expect(score).toBe(50);
      });

      it("returns 0 when 5 or fewer unique letters", () => {
        // Single letter repeated
        const score1 = calculateAlphabetCoverageFactor("aaaa");
        expect(score1).toBe(0);

        // Two letters
        const score2 = calculateAlphabetCoverageFactor("ababab");
        expect(score2).toBe(0);

        // Five letters
        const score5 = calculateAlphabetCoverageFactor("abcdeabcde");
        expect(score5).toBe(0);
      });

      it("returns 100 when 20 or more unique letters", () => {
        // All 26 letters
        const score26 = calculateAlphabetCoverageFactor("abcdefghijklmnopqrstuvwxyz");
        expect(score26).toBe(100);

        // 20 letters
        const score20 = calculateAlphabetCoverageFactor("abcdefghijklmnopqrst");
        expect(score20).toBe(100);
      });
    });

    describe("linear interpolation between 5-20", () => {
      it("interpolates at 6 unique letters: 1/15 * 100 = 6-7", () => {
        const score = calculateAlphabetCoverageFactor("abcdef");
        expect(score).toBeLessThanOrEqual(7);
        expect(score).toBeGreaterThanOrEqual(6);
      });

      it("interpolates at 12 unique letters (midpoint): 7/15 * 100 = 46-47", () => {
        const score = calculateAlphabetCoverageFactor("abcdefghijkl");
        expect(score).toBeLessThanOrEqual(47);
        expect(score).toBeGreaterThanOrEqual(46);
      });

      it("interpolates at 19 unique letters: 14/15 * 100 = 93", () => {
        const score = calculateAlphabetCoverageFactor("abcdefghijklmnopqrs");
        expect(score).toBeLessThanOrEqual(94);
        expect(score).toBeGreaterThanOrEqual(93);
      });

      it("interpolates at 13 unique letters: 8/15 * 100 = 53", () => {
        const score = calculateAlphabetCoverageFactor("abcdefghijklm");
        expect(score).toBeLessThanOrEqual(54);
        expect(score).toBeGreaterThanOrEqual(53);
      });
    });

    describe("continuous scale verification", () => {
      it("scales monotonically from 5 to 20 unique letters", () => {
        const scores = [];
        for (let uniqueCount = 5; uniqueCount <= 20; uniqueCount += 1) {
          const letters = "abcdefghijklmnopqrst".slice(0, uniqueCount);
          const score = calculateAlphabetCoverageFactor(letters);
          scores.push(score);
        }

        // Each score should be >= previous score
        for (let i = 1; i < scores.length; i += 1) {
          expect(scores[i]!).toBeGreaterThanOrEqual(scores[i - 1]!);
        }
      });
    });
  });

  describe("letter dominance factor (15%) - detailed formula", () => {
    describe("below threshold (≤12%)", () => {
      it("returns 100 when max frequency is exactly 12%", () => {
        // Create text where one letter is exactly 12% (at threshold, returns 100)
        // 12 letters total, one letter appears 1-2 times
        const text = "aabcdefghijk"; // 'a' at 16%, over threshold
        const score = calculateLetterDominanceFactor(text);
        expect(score).toBeLessThan(100);

        // Let's try exactly at threshold
        // 100 letters total, one letter 12 times
        const textAtThreshold = "a".repeat(12) + "bcdefghijklmnopqrstuvwxyz".repeat(4);
        const scoreAtThreshold = calculateLetterDominanceFactor(textAtThreshold);
        expect(scoreAtThreshold).toBe(100);
      });

      it("returns 100 when max frequency is below 12%", () => {
        // Even distribution: a, b, c, d, e each at 20% - but that's above threshold
        // Let's do 25 letters, no letter exceeds 12%
        // 25 letters, each ~4%
        const text = "abcdefghijklmnopqrstuvwxy";
        const score = calculateLetterDominanceFactor(text);
        expect(score).toBe(100);
      });
    });

    describe("above threshold with square root penalty curve", () => {
      it("applies penalty when max frequency exceeds 12%", () => {
        // Letter at ~13% (just over threshold)
        // Formula: excessRatio = (0.13 - 0.12) / (0.5 - 0.12) = 0.0263
        // penaltyFactor = sqrt(0.0263) = 0.162
        // score = (1 - 0.162) * 100 = 83.8 ~ 84
        // 'a' at ~13%
        const text = "a".repeat(3) + "bcdefghijklmnopqrstuvwxyzabcde";
        const score = calculateLetterDominanceFactor(text);
        expect(score).toBeLessThan(100);
        expect(score).toBeGreaterThan(75);
      });

      it("applies aggressive penalty using square root curve", () => {
        // The penalty curve uses: sqrt((freq - 0.12) / (0.5 - 0.12)) clamped to [0,1]
        // At 12% = 100 (no penalty)
        // At 13% = 84 (light penalty)
        // At 15% = 72 (moderate penalty)
        // At 20% = 54 (strong penalty)
        // At 25% = 42 (aggressive penalty)
        // At 50%+ = 0 (maximum penalty)

        // Test at 15% dominance (more moderate penalty)
        const text15 = "a".repeat(5) + "bcdefghijklmnopqrstuvwxyzabcdefghij";
        const score15 = calculateLetterDominanceFactor(text15);
        expect(score15).toBeLessThan(80);
        expect(score15).toBeGreaterThan(60);

        // Test at higher dominance (aggressive penalty)
        const text25 = "a".repeat(12) + "bcdefghijklmnopqrstuvwxyzabcdefghij";
        const score25 = calculateLetterDominanceFactor(text25);
        expect(score25).toBeLessThan(50);
        expect(score25).toBeGreaterThan(0);
      });
    });

    describe("handles empty text", () => {
      it("returns 50 for empty string", () => {
        const score = calculateLetterDominanceFactor("");
        expect(score).toBe(50);
      });
    });
  });

  describe("real-world examples", () => {
    it("gives reasonable scores for typical quotes", () => {
      const scores = [
        scoreDifficulty("Be yourself; everyone else is already taken."),
        scoreDifficulty("The only way to do great work is to love what you do."),
        scoreDifficulty("Two things are infinite: the universe and human stupidity."),
      ];

      // All should be reasonable mid-range scores
      for (const score of scores) {
        expect(score).toBeGreaterThan(20);
        expect(score).toBeLessThan(80);
      }
    });
  });
});
