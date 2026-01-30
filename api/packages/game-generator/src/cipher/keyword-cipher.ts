import type { DateTime } from "luxon";
import type { Quote, Puzzle, CipherMapping } from "../types.js";
import type { QuoteSource } from "../quotes/types.js";
import type { GameGenerator } from "./types.js";
import { hashString, createSeededRng, selectFromArray } from "../random.js";
import { generateHints } from "../hints/index.js";
import { KEYWORDS } from "../data/keywords.js";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Build a cipher alphabet from a keyword.
 * The keyword letters come first (deduplicated), followed by remaining letters.
 * Example: keyword "PUZZLE" → "PUZZLEABCDFGHIJKMNOQRSTVWXY"
 * (Note: duplicate letters in keyword are kept as-is, remaining letters fill gaps)
 */
function buildCipherAlphabet(keyword: string): string {
  const upperKeyword = keyword.toUpperCase();
  const usedLetters = new Set<string>();
  let cipherAlphabet = "";

  // Add unique letters from keyword
  for (const char of upperKeyword) {
    if (!usedLetters.has(char) && ALPHABET.includes(char)) {
      cipherAlphabet += char;
      usedLetters.add(char);
    }
  }

  // Add remaining letters in order
  for (const char of ALPHABET) {
    if (!usedLetters.has(char)) {
      cipherAlphabet += char;
    }
  }

  return cipherAlphabet;
}

/**
 * Build a mapping from plaintext letters to ciphertext letters.
 */
function buildCipherMapping(cipherAlphabet: string): CipherMapping {
  const mapping: Record<string, string> = {};

  for (let i = 0; i < ALPHABET.length; i++) {
    const plain = ALPHABET[i];
    const cipher = cipherAlphabet[i];
    if (!plain || !cipher) {
      throw new Error(`Invalid cipher alphabet: expected 26 letters, got ${cipherAlphabet.length}`);
    }
    mapping[plain.toLowerCase()] = cipher;
  }

  return mapping;
}

/**
 * Encrypt text using a cipher mapping.
 * Preserves non-letter characters (spaces, punctuation).
 * Always outputs uppercase letters for consistency with the cipher alphabet.
 */
function encryptText(text: string, mapping: CipherMapping): string {
  return [...text]
    .map((char) => {
      const lower = char.toLowerCase();
      if (lower in mapping) {
        // Always return uppercase encrypted letter
        return mapping[lower];
      }
      // Non-letter characters pass through unchanged
      return char;
    })
    .join("");
}

/**
 * Generates puzzles using keyword substitution cipher.
 */
export class KeywordCipherGenerator implements GameGenerator {
  constructor(private readonly quoteSource: QuoteSource) {}

  generatePuzzle(quote: Quote, seed?: string): Puzzle {
    // Select keyword based on seed
    const seedHash: number = seed === undefined ? Date.now() : hashString(seed);
    const rng = createSeededRng(seedHash);
    const keyword = selectFromArray(KEYWORDS, rng);

    // Build cipher
    const cipherAlphabet = buildCipherAlphabet(keyword);
    const mapping = buildCipherMapping(cipherAlphabet);

    // Encrypt
    const encryptedText = encryptText(quote.text, mapping);

    // Generate default hints (2 reveals)
    const hints = generateHints(mapping, 2);

    return {
      quoteId: quote.id,
      encryptedText,
      mapping,
      hints,
    };
  }

  async generateDailyPuzzle(date: DateTime): Promise<Puzzle> {
    // Create date seed in YYYY-MM-DD format using Luxon
    const dateSeed = date.toISODate();
    if (dateSeed === null) {
      throw new Error("Invalid date provided to generateDailyPuzzle");
    }

    // Get quote using date seed
    const quote = await this.quoteSource.getRandomQuote(dateSeed);

    // Generate puzzle with date seed
    return this.generatePuzzle(quote, dateSeed);
  }
}
