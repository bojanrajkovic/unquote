// pattern: Imperative Shell

/**
 * Check if the browser supports writing images to clipboard via ClipboardItem.
 * Returns false if the API is unavailable or restricted.
 */
export function canCopyImage(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof ClipboardItem !== "undefined" &&
    typeof navigator.clipboard?.write === "function"
  );
}

/**
 * Check if the browser supports the Web Share API with file sharing.
 * Tests with a minimal PNG file to verify file support (Level 2).
 *
 * Returns false on Firefox (no file share support) and desktop browsers
 * that don't support navigator.canShare with files.
 */
export function canNativeShare(): boolean {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.share !== "function" ||
    typeof navigator.canShare !== "function"
  ) {
    return false;
  }

  try {
    const testFile = new File([], "test.png", { type: "image/png" });
    return navigator.canShare({ files: [testFile] });
  } catch {
    return false;
  }
}
