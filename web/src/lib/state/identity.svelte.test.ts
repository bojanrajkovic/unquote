import { describe, it, expect, beforeEach } from "vitest";

import { identity } from "./identity.svelte";
import { STORAGE_KEYS, storageGet } from "../storage";

describe("IdentityState", () => {
  beforeEach(() => {
    // Reset the singleton to a known blank state between tests
    identity.clear();
    localStorage.clear();
  });

  describe("initial state", () => {
    it("starts with null claimCode", () => {
      expect(identity.claimCode).toBeNull();
    });

    it("starts with hasOnboarded false", () => {
      expect(identity.hasOnboarded).toBe(false);
    });
  });

  describe("setClaimCode()", () => {
    it("sets claimCode on the state", () => {
      identity.setClaimCode("BRAVE-LION-1234");
      expect(identity.claimCode).toBe("BRAVE-LION-1234");
    });

    it("sets hasOnboarded to true", () => {
      identity.setClaimCode("BRAVE-LION-1234");
      expect(identity.hasOnboarded).toBe(true);
    });

    it("persists claim code to localStorage", () => {
      identity.setClaimCode("BRAVE-LION-1234");
      expect(storageGet(STORAGE_KEYS.CLAIM_CODE)).toBe("BRAVE-LION-1234");
    });

    it("persists onboarded flag to localStorage", () => {
      identity.setClaimCode("BRAVE-LION-1234");
      expect(storageGet(STORAGE_KEYS.HAS_ONBOARDED)).toBe("true");
    });
  });

  describe("setSkipped()", () => {
    it("sets hasOnboarded to true", () => {
      identity.setSkipped();
      expect(identity.hasOnboarded).toBe(true);
    });

    it("does not set claimCode", () => {
      identity.setSkipped();
      expect(identity.claimCode).toBeNull();
    });

    it("persists onboarded flag without a claim code", () => {
      identity.setSkipped();
      expect(storageGet(STORAGE_KEYS.HAS_ONBOARDED)).toBe("true");
      expect(storageGet(STORAGE_KEYS.CLAIM_CODE)).toBeNull();
    });
  });

  describe("clear()", () => {
    it("resets claimCode to null", () => {
      identity.setClaimCode("BRAVE-LION-1234");
      identity.clear();
      expect(identity.claimCode).toBeNull();
    });

    it("resets hasOnboarded to false", () => {
      identity.setClaimCode("BRAVE-LION-1234");
      identity.clear();
      expect(identity.hasOnboarded).toBe(false);
    });

    it("removes claim code from localStorage", () => {
      identity.setClaimCode("BRAVE-LION-1234");
      identity.clear();
      expect(storageGet(STORAGE_KEYS.CLAIM_CODE)).toBeNull();
    });

    it("removes onboarded flag from localStorage", () => {
      identity.setClaimCode("BRAVE-LION-1234");
      identity.clear();
      expect(storageGet(STORAGE_KEYS.HAS_ONBOARDED)).toBeNull();
    });
  });
});
