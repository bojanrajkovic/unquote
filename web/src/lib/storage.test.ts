import { describe, it, expect, beforeEach } from "vitest";
import {
  STORAGE_KEYS,
  storageGet,
  storageSet,
  storageRemove,
  storageGetJson,
  storageSetJson,
} from "./storage";

describe("storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("storageGet / storageSet", () => {
    it("AC3.5: returns null for missing key", () => {
      expect(storageGet(STORAGE_KEYS.CLAIM_CODE)).toBeNull();
    });

    it("AC3.3: returns stored value after set", () => {
      storageSet(STORAGE_KEYS.CLAIM_CODE, "BRAVE-LION-1234");
      expect(storageGet(STORAGE_KEYS.CLAIM_CODE)).toBe("BRAVE-LION-1234");
    });
  });

  describe("storageRemove", () => {
    it("AC3.5: removes a stored key", () => {
      storageSet(STORAGE_KEYS.CLAIM_CODE, "BRAVE-LION-1234");
      storageRemove(STORAGE_KEYS.CLAIM_CODE);
      expect(storageGet(STORAGE_KEYS.CLAIM_CODE)).toBeNull();
    });

    it("AC3.5: does not throw when key does not exist", () => {
      expect(() => storageRemove(STORAGE_KEYS.PUZZLE)).not.toThrow();
    });
  });

  describe("storageGetJson / storageSetJson", () => {
    it("AC3.1: round-trips a JSON object", () => {
      const data = { date: "2026-02-21", guesses: { A: "E", B: "L" } };
      storageSetJson(STORAGE_KEYS.PUZZLE, data);
      expect(storageGetJson(STORAGE_KEYS.PUZZLE)).toEqual(data);
    });

    it("AC3.1: returns null for missing key", () => {
      expect(storageGetJson(STORAGE_KEYS.PUZZLE)).toBeNull();
    });

    it("AC3.1: returns null for invalid JSON", () => {
      localStorage.setItem(STORAGE_KEYS.PUZZLE, "not-json");
      expect(storageGetJson(STORAGE_KEYS.PUZZLE)).toBeNull();
    });
  });
});
