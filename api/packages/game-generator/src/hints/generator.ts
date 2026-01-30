import type { CipherMapping, Hint } from "../types.js";
import { LETTER_FREQUENCY } from "../difficulty/letter-data.js";

const DEFAULT_HINT_COUNT = 2;

/**
 * Generate hints by revealing letter mappings.
 * Prioritizes less common letters (more helpful to reveal rare letters).
 *
 * @param mapping - The cipher mapping (plaintext → ciphertext)
 * @param count - Number of hints to generate (default: 2)
 * @returns Array of hints revealing letter mappings
 */
export function generateHints(mapping: CipherMapping, count: number = DEFAULT_HINT_COUNT): Hint[] {
  if (count <= 0) {
    return [];
  }

  const entries = Object.entries(mapping);

  if (entries.length === 0) {
    return [];
  }

  // Sort by letter frequency (ascending = less common first)
  const sortedEntries = entries.toSorted(([letterA], [letterB]) => {
    const freqA = LETTER_FREQUENCY[letterA] ?? 0;
    const freqB = LETTER_FREQUENCY[letterB] ?? 0;
    return freqA - freqB;
  });

  // Take requested count (or all if fewer available)
  const selectedCount = Math.min(count, sortedEntries.length);
  const selectedEntries = sortedEntries.slice(0, selectedCount);

  // Convert to Hint objects
  return selectedEntries.map(([plainLetter, cipherLetter]) => ({
    cipherLetter,
    plainLetter,
  }));
}
