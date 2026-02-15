import { timingSafeEqual } from "node:crypto";
import { withSpan } from "./tracing.js";

/**
 * Normalize text for comparison.
 * - Applies Unicode NFC normalization
 * - Converts to lowercase
 * - Collapses all whitespace to single spaces
 * - Trims leading and trailing whitespace
 */
function normalizeText(text: string): string {
  return text.normalize("NFC").toLowerCase().replaceAll(/\s+/g, " ").trim();
}

/**
 * Validate a player's solution against the original quote.
 *
 * Comparison is case-insensitive, whitespace-normalized, and timing-safe
 * to prevent side-channel attacks that could leak solution characters.
 *
 * @param submission - The player's attempted solution
 * @param originalQuote - The original quote text
 * @returns true if the solution matches, false otherwise
 */
export const validateSolution = withSpan(
  "validateSolution",
  (_span, submission: string, originalQuote: string): boolean => {
    const normalizedSubmission = normalizeText(submission);
    const normalizedOriginal = normalizeText(originalQuote);

    const submissionBuffer = Buffer.from(normalizedSubmission, "utf-8");
    const originalBuffer = Buffer.from(normalizedOriginal, "utf-8");

    const maxLength = Math.max(submissionBuffer.length, originalBuffer.length);
    const paddedSubmission = Buffer.alloc(maxLength);
    const paddedOriginal = Buffer.alloc(maxLength);

    submissionBuffer.copy(paddedSubmission);
    originalBuffer.copy(paddedOriginal);

    return timingSafeEqual(paddedSubmission, paddedOriginal) && submissionBuffer.length === originalBuffer.length;
  },
);
