import type { Quote } from "../types.js";
import { QuoteSource } from "./types.js";

/**
 * QuoteSource backed by an in-memory array.
 * No I/O — suitable for tests, static datasets, or embedding quotes
 * directly in an application.
 */
export class InMemoryQuoteSource extends QuoteSource {
  constructor(private readonly quotes: readonly Quote[]) {
    super();
  }

  async getAllQuotes(): Promise<Quote[]> {
    return [...this.quotes];
  }
}
