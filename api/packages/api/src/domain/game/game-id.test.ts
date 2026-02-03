import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import Sqids from "sqids";
import { encodeGameId, decodeGameId } from "./game-id.js";

describe("game-id", () => {
  describe("encodeGameId", () => {
    it("returns a non-empty string", () => {
      const date = DateTime.fromISO("2026-02-01", { zone: "utc" });
      const id = encodeGameId(date);

      expect(id).toBeTruthy();
      expect(typeof id).toBe("string");
    });

    it("returns at least 8 characters", () => {
      const date = DateTime.fromISO("2026-02-01", { zone: "utc" });
      const id = encodeGameId(date);

      expect(id.length).toBeGreaterThanOrEqual(8);
    });

    it("returns URL-safe characters only", () => {
      const date = DateTime.fromISO("2026-02-01", { zone: "utc" });
      const id = encodeGameId(date);

      expect(id).toMatch(/^[a-zA-Z0-9]+$/);
    });

    it("is deterministic - same date produces same ID", () => {
      const date1 = DateTime.fromISO("2026-02-01", { zone: "utc" });
      const date2 = DateTime.fromISO("2026-02-01", { zone: "utc" });

      expect(encodeGameId(date1)).toBe(encodeGameId(date2));
    });

    it("produces different IDs for different dates", () => {
      const date1 = DateTime.fromISO("2026-02-01", { zone: "utc" });
      const date2 = DateTime.fromISO("2026-02-02", { zone: "utc" });

      expect(encodeGameId(date1)).not.toBe(encodeGameId(date2));
    });

    it("ignores time component - same date at different times produces same ID", () => {
      const morning = DateTime.fromISO("2026-02-01T08:00:00", { zone: "utc" });
      const evening = DateTime.fromISO("2026-02-01T20:00:00", { zone: "utc" });

      expect(encodeGameId(morning)).toBe(encodeGameId(evening));
    });
  });

  describe("decodeGameId", () => {
    it("decodes a valid game ID back to the original date", () => {
      const originalDate = DateTime.fromISO("2026-02-01", { zone: "utc" });
      const id = encodeGameId(originalDate);
      const decodedDate = decodeGameId(id);

      expect(decodedDate).not.toBeNull();
      expect(decodedDate!.toISODate()).toBe("2026-02-01");
    });

    it("returns null for empty string", () => {
      expect(decodeGameId("")).toBeNull();
    });

    it("returns null for invalid characters", () => {
      expect(decodeGameId("!!!invalid!!!")).toBeNull();
    });

    it("returns null for ID that decodes to wrong number of components", () => {
      // Create an ID that encodes a single number (wrong format)
      const singleNumberSqids = new Sqids({ minLength: 8 });
      const singleNumId = singleNumberSqids.encode([12_345]);
      expect(decodeGameId(singleNumId)).toBeNull();

      // Create an ID that encodes too many numbers
      const tooManyId = singleNumberSqids.encode([2026, 2, 1, 99]);
      expect(decodeGameId(tooManyId)).toBeNull();
    });

    it("returns null for invalid month", () => {
      // Encode an invalid month directly
      const invalidSqids = new Sqids({ minLength: 8 });
      const badMonthId = invalidSqids.encode([2026, 13, 1]);
      expect(decodeGameId(badMonthId)).toBeNull();
    });

    it("returns null for invalid day", () => {
      // Encode February 30 (invalid date)
      const invalidSqids = new Sqids({ minLength: 8 });
      const badDayId = invalidSqids.encode([2026, 2, 30]);
      expect(decodeGameId(badDayId)).toBeNull();
    });
  });

  describe("roundtrip", () => {
    it.each([
      ["1970-01-01"],
      ["2000-01-01"],
      ["2026-02-01"],
      ["2099-12-31"],
      ["2024-02-29"], // leap year
    ])("encode then decode returns same date for %s", (dateStr) => {
      const originalDate = DateTime.fromISO(dateStr, { zone: "utc" });
      const id = encodeGameId(originalDate);
      const decodedDate = decodeGameId(id);

      expect(decodedDate).not.toBeNull();
      expect(decodedDate!.toISODate()).toBe(originalDate.toISODate());
    });
  });
});
