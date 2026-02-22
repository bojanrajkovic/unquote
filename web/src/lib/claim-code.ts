/**
 * Validates and normalizes a claim code.
 * Valid format: WORD-WORD-NNNN (two uppercase words separated by hyphens, four digits).
 * Examples: AMBER-HAWK-7842, CIPHER-TURING-0001
 *
 * Returns the trimmed, uppercased code if valid, null otherwise.
 */
export function validateClaimCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  if (/^[A-Z]+-[A-Z]+-\d{4}$/.test(code)) {
    return code;
  }
  return null;
}
