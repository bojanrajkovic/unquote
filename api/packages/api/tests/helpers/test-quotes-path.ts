import { resolve } from "node:path";
import { existsSync } from "node:fs";

/**
 * Returns path to test quotes file.
 * Uses the shared quotes.json from api/resources/ for consistent test data.
 */
export function getTestQuotesPath(): string {
  // The quotes file is in the shared resources directory at api root level
  // Use relative path from this file to reach it reliably
  const quotesPath = resolve(
    import.meta.dirname,
    "../../../../resources/quotes.json",
  );

  if (!existsSync(quotesPath)) {
    throw new Error(
      `Test quotes file not found at ${quotesPath}. ` +
        "Ensure api/resources/quotes.json exists.",
    );
  }

  return quotesPath;
}
