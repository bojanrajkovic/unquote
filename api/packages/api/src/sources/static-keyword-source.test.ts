import { describe, it, expect } from "vitest";
import { StaticKeywordSource } from "./static-keyword-source.js";

describe("StaticKeywordSource", () => {
  it("returns keywords from the KEYWORDS constant", async () => {
    const source = new StaticKeywordSource();
    const keywords = await source.getKeywords();

    expect(keywords.length).toBeGreaterThan(0);
    // KEYWORDS constant has 30 keywords
    expect(keywords.length).toBe(30);
  });

  it("returns the same keywords on every call", async () => {
    const source = new StaticKeywordSource();
    const first = await source.getKeywords();
    const second = await source.getKeywords();

    expect(first).toEqual(second);
  });

  it("returns strings that are all uppercase", async () => {
    const source = new StaticKeywordSource();
    const keywords = await source.getKeywords();

    for (const keyword of keywords) {
      expect(keyword).toBe(keyword.toUpperCase());
    }
  });
});
