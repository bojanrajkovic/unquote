/**
 * Normalize text for comparison.
 * - Converts to lowercase
 * - Collapses all whitespace to single spaces
 * - Trims leading and trailing whitespace
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replaceAll(/\s+/g, " ").trim();
}

/**
 * Validate a player's solution against the original quote.
 *
 * Comparison is case-insensitive and whitespace-normalized.
 * Punctuation must match exactly.
 *
 * @param submission - The player's attempted solution
 * @param originalQuote - The original quote text
 * @returns true if the solution matches, false otherwise
 */
export function validateSolution(submission: string, originalQuote: string): boolean {
  const normalizedSubmission = normalizeText(submission);
  const normalizedOriginal = normalizeText(originalQuote);

  return normalizedSubmission === normalizedOriginal;
}
