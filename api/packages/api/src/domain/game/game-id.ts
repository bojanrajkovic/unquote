import Sqids from "sqids";
import { DateTime } from "luxon";

const sqids = new Sqids({ minLength: 8 });

/**
 * Encodes a date into an opaque game ID.
 * Encodes year, month, day as separate components for semantic clarity.
 *
 * @param date - The Luxon DateTime to encode
 * @returns Opaque game ID string
 */
export function encodeGameId(date: DateTime): string {
  return sqids.encode([date.year, date.month, date.day]);
}

/**
 * Decodes a game ID back to its original date.
 * Returns null if the ID is invalid or cannot be decoded.
 *
 * @param id - The game ID to decode
 * @returns The decoded DateTime (UTC), or null if invalid
 */
export function decodeGameId(id: string): DateTime | null {
  const decoded = sqids.decode(id);

  if (decoded.length !== 3) {
    return null;
  }

  // Type guard: destructure after length check
  const year = decoded[0];
  const month = decoded[1];
  const day = decoded[2];

  // Validate reasonable ranges
  if (year === undefined || month === undefined || day === undefined) {
    return null;
  }

  if (year < 1970 || year > 2100) {
    return null;
  }
  if (month < 1 || month > 12) {
    return null;
  }
  if (day < 1 || day > 31) {
    return null;
  }

  const dt = DateTime.utc(year, month, day);

  // Luxon validates the actual date (e.g., Feb 30 is invalid)
  if (!dt.isValid) {
    return null;
  }

  return dt;
}
