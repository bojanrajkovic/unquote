import { describe, it, expect } from "vitest";
import { validateSolution } from "./validation.js";

describe("validateSolution", () => {
  describe("exact match", () => {
    it("returns true for exact match", () => {
      const result = validateSolution("Hello World", "Hello World");

      expect(result).toBe(true);
    });
  });

  describe("case insensitivity", () => {
    it("ignores case differences", () => {
      const result = validateSolution("HELLO WORLD", "hello world");

      expect(result).toBe(true);
    });

    it("handles mixed case", () => {
      const result = validateSolution("HeLLo WoRLd", "hello WORLD");

      expect(result).toBe(true);
    });
  });

  describe("whitespace normalization", () => {
    it("collapses multiple spaces", () => {
      const result = validateSolution("Hello    World", "Hello World");

      expect(result).toBe(true);
    });

    it("trims leading whitespace", () => {
      const result = validateSolution("   Hello World", "Hello World");

      expect(result).toBe(true);
    });

    it("trims trailing whitespace", () => {
      const result = validateSolution("Hello World   ", "Hello World");

      expect(result).toBe(true);
    });

    it("handles tabs and newlines", () => {
      const result = validateSolution("Hello\t\nWorld", "Hello World");

      expect(result).toBe(true);
    });
  });

  describe("punctuation", () => {
    it("preserves punctuation in comparison", () => {
      const result = validateSolution("Hello, World!", "Hello, World!");

      expect(result).toBe(true);
    });

    it("requires matching punctuation", () => {
      const result = validateSolution("Hello World", "Hello, World!");

      expect(result).toBe(false);
    });
  });

  describe("mismatches", () => {
    it("returns false for different text", () => {
      const result = validateSolution("Hello World", "Goodbye World");

      expect(result).toBe(false);
    });

    it("returns false for partial match", () => {
      const result = validateSolution("Hello", "Hello World");

      expect(result).toBe(false);
    });

    it("returns false for extra text", () => {
      const result = validateSolution("Hello World Extra", "Hello World");

      expect(result).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles empty strings", () => {
      const result = validateSolution("", "");

      expect(result).toBe(true);
    });

    it("returns false for empty vs non-empty", () => {
      const result = validateSolution("", "Hello");

      expect(result).toBe(false);
    });

    it("handles only whitespace", () => {
      const result = validateSolution("   ", "");

      expect(result).toBe(true);
    });
  });

  describe("real-world examples", () => {
    it("validates a correct quote submission", () => {
      const original = "The only way to do great work is to love what you do.";
      const submission = "the only way to do great work is to love what you do.";

      const result = validateSolution(submission, original);

      expect(result).toBe(true);
    });

    it("rejects an incorrect quote submission", () => {
      const original = "The only way to do great work is to love what you do.";
      const submission = "the only way to do good work is to love what you do.";

      const result = validateSolution(submission, original);

      expect(result).toBe(false);
    });
  });
});
