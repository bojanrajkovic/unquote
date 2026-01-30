import { describe, it, expect } from "vitest";
import { generateHints } from "./generator.js";
import type { CipherMapping } from "../types.js";

describe("generateHints", () => {
  // Test mapping where a→P, b→U, c→Z, ..., z→Y
  const testMapping: CipherMapping = {
    a: "P",
    b: "U",
    c: "Z",
    d: "Z",
    e: "L",
    f: "E",
    g: "A",
    h: "B",
    i: "C",
    j: "D",
    k: "F",
    l: "G",
    m: "H",
    n: "I",
    o: "J",
    p: "K",
    q: "M",
    r: "N",
    s: "O",
    t: "Q",
    u: "R",
    v: "S",
    w: "T",
    x: "V",
    y: "W",
    z: "X",
  };

  describe("returns correct number of hints", () => {
    it("returns requested number of hints", () => {
      const hints = generateHints(testMapping, 3);

      expect(hints.length).toBe(3);
    });

    it("returns all available if count exceeds mapping size", () => {
      const smallMapping: CipherMapping = { a: "X", b: "Y" };
      const hints = generateHints(smallMapping, 10);

      expect(hints.length).toBe(2);
    });

    it("returns default count when not specified", () => {
      const hints = generateHints(testMapping);

      // Default should be 1-2 hints
      expect(hints.length).toBeGreaterThanOrEqual(1);
      expect(hints.length).toBeLessThanOrEqual(2);
    });
  });

  describe("hint structure", () => {
    it("returns hints with correct structure", () => {
      const hints = generateHints(testMapping, 1);

      expect(hints[0]).toHaveProperty("cipherLetter");
      expect(hints[0]).toHaveProperty("plainLetter");
    });

    it("hints match the mapping", () => {
      const hints = generateHints(testMapping, 5);

      for (const hint of hints) {
        expect(testMapping[hint.plainLetter]).toBe(hint.cipherLetter);
      }
    });
  });

  describe("prioritizes less common letters", () => {
    it("prefers uncommon letters over common ones", () => {
      // Generate multiple hints
      const hints = generateHints(testMapping, 5);
      const revealedLetters = hints.map((h) => h.plainLetter);

      // Common letters like 'e', 't', 'a' should NOT be in first hints
      // Uncommon letters like 'z', 'q', 'x' are more likely
      const uncommonLetters = new Set(["z", "q", "x", "j", "k"]);

      // At least one uncommon letter should be revealed before all common
      const hasUncommon = revealedLetters.some((l) => uncommonLetters.has(l));
      expect(hasUncommon).toBe(true);
    });
  });

  describe("no duplicates", () => {
    it("returns unique hints", () => {
      const hints = generateHints(testMapping, 10);
      const cipherLetters = hints.map((h) => h.cipherLetter);
      const uniqueCipherLetters = new Set(cipherLetters);

      expect(cipherLetters.length).toBe(uniqueCipherLetters.size);
    });
  });

  describe("edge cases", () => {
    it("handles empty mapping", () => {
      const hints = generateHints({}, 3);

      expect(hints).toEqual([]);
    });

    it("handles count of 0", () => {
      const hints = generateHints(testMapping, 0);

      expect(hints).toEqual([]);
    });
  });
});
