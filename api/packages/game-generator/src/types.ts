// Quote type is defined in schemas.ts and exported from index.ts
export type { Quote } from "./schemas.js";

/**
 * Maps plaintext letters (lowercase) to ciphertext letters (uppercase).
 * Example: { a: 'P', b: 'U', c: 'Z', ... }
 */
export type CipherMapping = Record<string, string>;

/**
 * A revealed letter mapping given as a hint to the player.
 * Example: cipherLetter 'X' maps to plainLetter 't'
 */
export type Hint = {
  readonly cipherLetter: string;
  readonly plainLetter: string;
};

/**
 * An encrypted puzzle ready for the player to solve.
 */
export type Puzzle = {
  readonly quoteId: string;
  readonly encryptedText: string;
  readonly mapping: CipherMapping;
  readonly hints: readonly Hint[];
};
