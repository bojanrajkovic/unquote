import type { DateTime } from "luxon";
import type { Quote, Puzzle, CipherMapping } from "../types.js";
import type { QuoteSource } from "../quotes/types.js";
import type { GameGenerator, KeywordSource } from "./types.js";
import { hashString, createSeededRng, selectFromArray } from "../random.js";
import { generateHints } from "../hints/generator.js";
import { withSpan } from "../tracing.js";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Build a cipher alphabet from a keyword.
 * The keyword letters come first (deduplicated), followed by remaining letters.
 * Example: keyword "PUZZLE" → "PUZZLEABCDFGHIJKMNOQRSTVWXY"
 * (Note: duplicate letters in keyword are kept as-is, remaining letters fill gaps)
 */
const buildCipherAlphabet = withSpan("buildCipherAlphabet", (_span, keyword: string): string => {
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
});

/**
 * Eliminate self-mappings (where a letter maps to itself) by swapping
 * with the next non-self-mapping letter. Maintains bijectivity.
 */
function swapChars(chars: string[], i: number, j: number): void {
  const tmp = chars[i] ?? "";
  chars[i] = chars[j] ?? "";
  chars[j] = tmp;
}

const eliminateSelfMappings = withSpan("eliminateSelfMappings", (_span, cipherAlphabet: string): string => {
  const chars = [...cipherAlphabet];

  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === ALPHABET[i]) {
      // Find the next letter to swap with that won't create a new self-mapping
      let swapped = false;
      for (let j = i + 1; j < chars.length; j++) {
        // After swap: chars[i] would be chars[j], chars[j] would be chars[i] (which is ALPHABET[i])
        // Ensure neither creates a self-mapping
        if (chars[j] !== ALPHABET[i] && chars[i] !== ALPHABET[j]) {
          swapChars(chars, i, j);
          swapped = true;
          break;
        }
      }
      if (!swapped) {
        // Wrap around: search from the beginning
        for (let j = 0; j < i; j++) {
          if (chars[j] !== ALPHABET[i] && chars[i] !== ALPHABET[j]) {
            swapChars(chars, i, j);
            swapped = true;
            break;
          }
        }
      }
      if (!swapped) {
        throw new Error(`Unable to eliminate self-mapping for letter ${ALPHABET[i]} at position ${i}`);
      }
    }
  }

  return chars.join("");
});

/**
 * Build a mapping from plaintext letters to ciphertext letters.
 */
const buildCipherMapping = withSpan("buildCipherMapping", (_span, cipherAlphabet: string): CipherMapping => {
  const fixedAlphabet = eliminateSelfMappings(cipherAlphabet);
  const mapping: Record<string, string> = {};

  for (let i = 0; i < ALPHABET.length; i++) {
    const plain = ALPHABET[i];
    const cipher = fixedAlphabet[i];
    if (!plain || !cipher) {
      throw new Error(`Invalid cipher alphabet: expected 26 letters, got ${fixedAlphabet.length}`);
    }
    mapping[plain.toLowerCase()] = cipher;
  }

  return mapping;
});

/**
 * Encrypt text using a cipher mapping.
 * Preserves non-letter characters (spaces, punctuation).
 * Always outputs uppercase letters for consistency with the cipher alphabet.
 */
const encryptText = withSpan("encryptText", (_span, text: string, mapping: CipherMapping): string => {
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
});

/**
 * Generates puzzles using keyword substitution cipher.
 */
export class KeywordCipherGenerator implements GameGenerator {
  constructor(
    private readonly quoteSource: QuoteSource,
    private readonly keywordSource: KeywordSource,
  ) {}

  async generatePuzzle(quote: Quote, seed?: string): Promise<Puzzle> {
    // Load keywords from source
    const keywords = await this.keywordSource.getKeywords();

    // Select keyword based on seed
    const seedHash: number = seed === undefined ? Date.now() : hashString(seed);
    const rng = createSeededRng(seedHash);
    const keyword = selectFromArray(keywords, rng);

    // Build cipher
    const cipherAlphabet = buildCipherAlphabet(keyword);
    const mapping = buildCipherMapping(cipherAlphabet);

    // Encrypt
    const encryptedText = encryptText(quote.text, mapping);

    // Generate default hints (2 reveals) - pass encryptedText so hints are useful
    const hints = generateHints(mapping, encryptedText, 2);

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
