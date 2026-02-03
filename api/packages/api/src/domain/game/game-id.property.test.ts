import { describe, it } from "vitest";
import fc from "fast-check";
import { DateTime } from "luxon";
import { encodeGameId, decodeGameId } from "./game-id.js";

describe("game-id properties", () => {
  // Arbitrary for valid DateTime in supported range (1970-2099)
  const validDateTimeArbitrary = fc
    .record({
      year: fc.integer({ min: 1970, max: 2099 }),
      month: fc.integer({ min: 1, max: 12 }),
      day: fc.integer({ min: 1, max: 28 }), // Use 28 to avoid invalid dates
    })
    .map(({ year, month, day }) => DateTime.utc(year, month, day));

  describe("roundtrip property", () => {
    it("decode(encode(date)) returns same date", () => {
      fc.assert(
        fc.property(validDateTimeArbitrary, (date) => {
          const id = encodeGameId(date);
          const decoded = decodeGameId(id);

          if (decoded === null) {
            return false;
          }

          return decoded.toISODate() === date.toISODate();
        }),
      );
    });
  });

  describe("determinism property", () => {
    it("same date always produces same ID", () => {
      fc.assert(
        fc.property(validDateTimeArbitrary, (date) => {
          const id1 = encodeGameId(date);
          const id2 = encodeGameId(date);

          return id1 === id2;
        }),
      );
    });

    it("same date at different times produces same ID", () => {
      fc.assert(
        fc.property(
          validDateTimeArbitrary,
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 59 }),
          (date, hour, minute) => {
            const withTime = date.set({ hour, minute });
            return encodeGameId(date) === encodeGameId(withTime);
          },
        ),
      );
    });
  });

  describe("format properties", () => {
    it("encoded IDs are at least 8 characters", () => {
      fc.assert(
        fc.property(validDateTimeArbitrary, (date) => {
          const id = encodeGameId(date);
          return id.length >= 8;
        }),
      );
    });

    it("encoded IDs contain only alphanumeric characters", () => {
      fc.assert(
        fc.property(validDateTimeArbitrary, (date) => {
          const id = encodeGameId(date);
          return /^[a-zA-Z0-9]+$/.test(id);
        }),
      );
    });
  });

  describe("invalid input handling", () => {
    it("decoding arbitrary strings either returns valid DateTime or null", () => {
      fc.assert(
        fc.property(fc.string(), (str) => {
          const result = decodeGameId(str);

          if (result === null) {
            return true;
          }

          return result.isValid;
        }),
      );
    });
  });
});
