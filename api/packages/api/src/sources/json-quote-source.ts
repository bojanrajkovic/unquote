import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { Compile } from "typebox/compile";
import { Type } from "typebox";
import { QuoteSource, QuoteSchema, type Quote } from "@unquote/game-generator";

// Compile the schema for efficient validation at runtime
const QuoteArraySchema = Type.Array(QuoteSchema);
const validateQuotes = Compile(QuoteArraySchema);

/**
 * Loads quotes from a JSON file.
 * Caches quotes after first load.
 */
export class JsonQuoteSource extends QuoteSource {
  private quotes: Array<Quote> | null = null;
  private validated = false;

  constructor(private readonly filePath: string) {
    super();
  }

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

  async getAllQuotes(): Promise<Quote[]> {
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
}
