// pattern: Imperative Shell

const FEEDBACK_DURATION_MS = 2500;

/**
 * Copy text to clipboard and return true on success, false on failure.
 * Follows the existing copyCode() pattern from +page.svelte.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Trigger a timed feedback cycle. Sets the setter to the message string, then
 * resets to null after FEEDBACK_DURATION_MS.
 *
 * Returns a cleanup function that cancels the pending timeout
 * (useful if component unmounts).
 */
export function showFeedback(
  setter: (value: string | null) => void,
  message = "Copied!",
): () => void {
  setter(message);
  const id = setTimeout(() => setter(null), FEEDBACK_DURATION_MS);
  return () => clearTimeout(id);
}
