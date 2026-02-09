import type { Quote } from "../types.js";
import { hashString, createSeededRng, selectFromArray } from "../random.js";

/**
 * Abstraction over quote storage.
 * Implementations provide getAllQuotes(); seeded selection, ID lookup,
 * and eager validation are inherited.
 */
export abstract class QuoteSource {
  /**
   * Return all available quotes. Subclasses implement this as the sole
   * abstract method — file I/O, database access, or static data.
   */
  abstract getAllQuotes(): Promise<Quote[]>;

  /**
   * Retrieve a specific quote by ID.
   * @returns The quote if found, null otherwise
   */
  async getQuote(id: string): Promise<Quote | null> {
    const quotes = await this.getAllQuotes();
    return quotes.find((q) => q.id === id) ?? null;
  }

  /**
   * Retrieve a random quote.
   * @param seed - Optional seed for deterministic selection (e.g., date string)
   * @returns A randomly selected quote
   */
  async getRandomQuote(seed?: string): Promise<Quote> {
    const quotes = await this.getAllQuotes();

    if (quotes.length === 0) {
      throw new Error("No quotes available");
    }

    if (seed !== undefined) {
      const rng = createSeededRng(hashString(seed));
      return selectFromArray(quotes, rng);
    }

    const index = Math.floor(Math.random() * quotes.length);
    const quote = quotes[index];
    if (quote === undefined) {
      throw new Error("Unexpected: index out of bounds");
    }
    return quote;
  }

  /**
   * Eagerly validate that quotes can be loaded.
   * Call at startup for fail-fast behavior.
   */
  async ensureLoaded(): Promise<void> {
    await this.getAllQuotes();
  }
}
