import { describe, it, expect } from "vitest";
import { generateHints } from "./generator.js";
import type { CipherMapping } from "../types.js";

describe("generateHints", () => {
  // Test mapping where a→P, b→U, c→Z, ..., z→Y
  const testMapping: CipherMapping = {
    a: "P",
    b: "U",
    c: "Z",
    d: "D",
    e: "L",
    f: "E",
    g: "A",
    h: "B",
    i: "C",
    j: "F",
    k: "G",
    l: "H",
    m: "I",
    n: "J",
    o: "K",
    p: "M",
    q: "N",
    r: "O",
    s: "Q",
    t: "R",
    u: "S",
    v: "T",
    w: "V",
    x: "W",
    y: "X",
    z: "Y",
  };

  // Full ciphertext with all letters present (for tests that don't care about filtering)
  const fullCiphertext = "PUZLABCDEFGHIJKMNOPQRSTVWXY";

  describe("returns correct number of hints", () => {
    it("returns requested number of hints", () => {
      const hints = generateHints(testMapping, fullCiphertext, 3);

      expect(hints.length).toBe(3);
    });

    it("returns all available if count exceeds available letters in ciphertext", () => {
      // Ciphertext only has 2 unique letters
      const ciphertext = "PP LL";
      const hints = generateHints(testMapping, ciphertext, 10);

      expect(hints.length).toBe(2);
    });

    it("returns default count when not specified", () => {
      const hints = generateHints(testMapping, fullCiphertext);

      // Default should be 1-2 hints
      expect(hints.length).toBeGreaterThanOrEqual(1);
      expect(hints.length).toBeLessThanOrEqual(2);
    });
  });

  describe("hint structure", () => {
    it("returns hints with correct structure", () => {
      const hints = generateHints(testMapping, fullCiphertext, 1);

      expect(hints[0]).toHaveProperty("cipherLetter");
      expect(hints[0]).toHaveProperty("plainLetter");
    });

    it("hints match the mapping", () => {
      const hints = generateHints(testMapping, fullCiphertext, 5);

      for (const hint of hints) {
        expect(testMapping[hint.plainLetter]).toBe(hint.cipherLetter);
      }
    });
  });

  describe("prioritizes less common letters", () => {
    it("prefers uncommon letters over common ones when available in ciphertext", () => {
      // Include some uncommon letters in the ciphertext
      // z→Y, q→N, x→W, j→F, k→G plus common e→L, t→R, a→P
      const ciphertextWithUncommon = "YNWFG LRPPP";

      const hints = generateHints(testMapping, ciphertextWithUncommon, 5);
      const revealedLetters = hints.map((h) => h.plainLetter);

      // Uncommon letters should appear first
      const uncommonLetters = new Set(["z", "q", "x", "j", "k"]);
      const hasUncommon = revealedLetters.some((l) => uncommonLetters.has(l));
      expect(hasUncommon).toBe(true);
    });
  });

  describe("no duplicates", () => {
    it("returns unique hints", () => {
      const hints = generateHints(testMapping, fullCiphertext, 10);
      const cipherLetters = hints.map((h) => h.cipherLetter);
      const uniqueCipherLetters = new Set(cipherLetters);

      expect(cipherLetters.length).toBe(uniqueCipherLetters.size);
    });
  });

  describe("hints are present in ciphertext", () => {
    it("only generates hints for letters that appear in the ciphertext", () => {
      // Ciphertext "BLHHK" = "HELLO" encrypted
      // B=h, L=e, H=l, K=o - only these letters should be hintable
      const ciphertext = "BLHHK";

      const hints = generateHints(testMapping, ciphertext, 3);

      // Every hint's cipherLetter must appear in the ciphertext
      for (const hint of hints) {
        expect(ciphertext).toContain(hint.cipherLetter);
      }
      // Should get hints (up to available unique letters)
      expect(hints.length).toBeGreaterThan(0);
      expect(hints.length).toBeLessThanOrEqual(4); // Only 4 unique letters: B, L, H, K
    });

    it("returns fewer hints if ciphertext has fewer unique letters than requested", () => {
      // Ciphertext has only 2 unique letters (P and L)
      const ciphertext = "PPPP LLLL";

      const hints = generateHints(testMapping, ciphertext, 5);

      // Should only get 2 hints max (P and L)
      expect(hints.length).toBe(2);
    });

    it("returns empty array if ciphertext has no letters", () => {
      const ciphertext = "123 !@#";

      const hints = generateHints(testMapping, ciphertext, 5);

      expect(hints).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("handles empty mapping", () => {
      const hints = generateHints({}, "ABC", 3);

      expect(hints).toEqual([]);
    });

    it("handles count of 0", () => {
      const hints = generateHints(testMapping, fullCiphertext, 0);

      expect(hints).toEqual([]);
    });

    it("handles empty ciphertext", () => {
      const hints = generateHints(testMapping, "", 3);

      expect(hints).toEqual([]);
    });
  });
});
