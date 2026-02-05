import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { Compile } from "typebox/compile";
import { Type } from "typebox";
import type { Quote } from "../types.js";
import type { QuoteSource } from "./types.js";
import { hashString, createSeededRng, selectFromArray } from "../random.js";
import { QuoteSchema } from "../schemas.js";

// Compile the schema for efficient validation at runtime
const QuoteArraySchema = Type.Array(QuoteSchema);
const validateQuotes = Compile(QuoteArraySchema);

/**
 * Loads quotes from a JSON file.
 * Caches quotes after first load.
 */
export class JsonQuoteSource implements QuoteSource {
  private quotes: Array<Quote> | null = null;
  private validated = false;

  constructor(private readonly filePath: string) {}

  /**
   * Validate that the file exists and is readable.
   * Called lazily on first access to allow async validation.
   */
  private async validatePath(): Promise<void> {
    if (this.validated) {
      return;
    }

    try {
      await access(this.filePath, constants.R_OK);
      this.validated = true;
    } catch (error) {
      throw new Error(`Quote file not found or not readable: ${this.filePath}`, { cause: error });
    }
  }

  private async loadQuotes(): Promise<Quote[]> {
    if (this.quotes !== null) {
      return this.quotes;
    }

    await this.validatePath();

    const content = await readFile(this.filePath, "utf-8");
    const parsed = JSON.parse(content);

    if (!validateQuotes.Check(parsed)) {
      const errors = Array.from(validateQuotes.Errors(parsed));
      const errorMessages = errors.map((e) => `${e.instancePath || "root"}: ${e.message}`).join("; ");
      throw new Error(
        `Invalid quotes format in ${this.filePath}: ${errorMessages || "expected array of Quote objects with id, text, author, category, and difficulty fields"}`,
      );
    }

    this.quotes = parsed;
    return this.quotes;
  }

  async getQuote(id: string): Promise<Quote | null> {
    const quotes = await this.loadQuotes();
    return quotes.find((q) => q.id === id) ?? null;
  }

  async getRandomQuote(seed?: string): Promise<Quote> {
    const quotes = await this.loadQuotes();

    if (quotes.length === 0) {
      throw new Error("No quotes available");
    }

    if (seed !== undefined) {
      // Deterministic selection using shared RNG utilities
      const rng = createSeededRng(hashString(seed));
      return selectFromArray(quotes, rng);
    }

    // Random selection (unseeded)
    const index = Math.floor(Math.random() * quotes.length);
    const quote = quotes[index];
    if (quote === undefined) {
      throw new Error("Unexpected: no quotes available");
    }
    return quote;
  }
}
