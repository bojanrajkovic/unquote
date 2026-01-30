import type { DateTime } from "luxon";
import type { Quote, Puzzle } from "../types.js";

/**
 * Abstraction over cipher algorithms.
 * Implementations can use different encryption strategies.
 */
export interface GameGenerator {
  /**
   * Generate a puzzle from a quote with optional seed for determinism.
   * @param quote - The quote to encrypt
   * @param seed - Optional seed for deterministic cipher (e.g., date string)
   * @returns An encrypted puzzle
   */
  generatePuzzle(quote: Quote, seed?: string): Puzzle;

  /**
   * Generate a daily puzzle for a given date.
   * Same date always produces the same puzzle.
   * @param date - The date for the puzzle (Luxon DateTime)
   * @returns An encrypted puzzle
   */
  generateDailyPuzzle(date: DateTime): Promise<Puzzle>;
}
