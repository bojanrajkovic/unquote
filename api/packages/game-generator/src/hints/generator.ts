import type { CipherMapping, Hint } from "../types.js";
import { LETTER_FREQUENCY } from "../difficulty/letter-data.js";
import { withSpan } from "../tracing.js";

const DEFAULT_HINT_COUNT = 2;

/**
 * Generate hints by revealing letter mappings.
 * Only generates hints for letters that appear in the ciphertext.
 * Prioritizes less common letters (more helpful to reveal rare letters).
 *
 * @param mapping - The cipher mapping (plaintext → ciphertext)
 * @param ciphertext - The encrypted text (hints will only use letters present here)
 * @param count - Number of hints to generate (default: 2)
 * @returns Array of hints revealing letter mappings
 */
export const generateHints = withSpan(
  "generateHints",
  (_span, mapping: CipherMapping, ciphertext: string, count: number = DEFAULT_HINT_COUNT): Hint[] => {
    if (count <= 0) {
      return [];
    }

    // Extract unique uppercase letters from ciphertext
    const ciphertextLetters = new Set([...ciphertext.toUpperCase()].filter((char) => /[A-Z]/.test(char)));

    if (ciphertextLetters.size === 0) {
      return [];
    }

    // Filter mapping to only letters present in ciphertext
    const entries = Object.entries(mapping).filter(([, cipherLetter]) => ciphertextLetters.has(cipherLetter));

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
  },
);
