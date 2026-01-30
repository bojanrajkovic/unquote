import type { Quote } from "../types.js";

/**
 * Abstraction over quote storage.
 * Implementations can load from JSON files, databases, APIs, etc.
 */
export interface QuoteSource {
  /**
   * Retrieve a specific quote by ID.
   * @returns The quote if found, null otherwise
   */
  getQuote(id: string): Promise<Quote | null>;

  /**
   * Retrieve a random quote.
   * @param seed - Optional seed for deterministic selection (e.g., date string)
   * @returns A randomly selected quote
   */
  getRandomQuote(seed?: string): Promise<Quote>;
}
