// pattern: Imperative Shell

import { domToBlob } from "modern-screenshot";

const FONT_TIMEOUT_MS = 3000;
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 628;

/**
 * Wait for fonts to load with a timeout.
 * Proceeds with system font substitution if fonts don't load in time.
 */
async function waitForFonts(): Promise<void> {
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS)),
    ]);
  } catch {
    // Font loading failed — proceed with available fonts
  }
}

/**
 * Capture a DOM element as a PNG Blob using modern-screenshot.
 *
 * Waits for fonts to load first (with timeout), then captures at
 * 2x scale for retina quality.
 *
 * Returns null if capture fails (caller should fall back to text).
 */
export async function captureElementAsBlob(
  element: HTMLElement,
): Promise<Blob | null> {
  await waitForFonts();

  try {
    return await domToBlob(element, {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      scale: 2,
    });
  } catch {
    return null;
  }
}
