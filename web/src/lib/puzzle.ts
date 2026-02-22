/**
 * Pure domain logic for the cryptoquip puzzle.
 *
 * All functions are stateless and deterministic.
 * No Svelte, no localStorage, no fetch — fully unit-testable.
 */

import type { Hint } from "./api";

// ─── Cell types ─────────────────────────────────────────────────────────────

/**
 * A "letter" cell is an encrypted letter the player can guess.
 * editIndex is its 0-based position among all editable cells (for cursor navigation).
 */
export interface LetterCell {
  kind: "letter";
  index: number; // position in the full cell array
  editIndex: number; // position among editable cells only
  cipherLetter: string; // uppercase, e.g. "X"
  guess: string | null; // player's current guess (uppercase) or null
}

/**
 * A "hint" cell is a pre-revealed letter (not editable).
 * Displayed in teal.
 */
export interface HintCell {
  kind: "hint";
  index: number;
  cipherLetter: string;
  plainLetter: string; // pre-revealed, uppercase
}

/**
 * A "punct" cell is punctuation (comma, period, etc.) — displayed as-is, not editable.
 */
export interface PunctCell {
  kind: "punct";
  index: number;
  char: string;
}

/**
 * A "space" cell is a word separator — rendered as whitespace.
 */
export interface SpaceCell {
  kind: "space";
  index: number;
}

export type Cell = LetterCell | HintCell | PunctCell | SpaceCell;

// ─── buildCells ─────────────────────────────────────────────────────────────

/**
 * Build the full cell array for the puzzle grid.
 *
 * Iterates over each character of encryptedText:
 * - Uppercase letters: HintCell if revealed in hints, otherwise LetterCell
 * - Spaces: SpaceCell
 * - Everything else (punctuation): PunctCell
 *
 * The guess for each LetterCell comes from the guesses map (cipherLetter → plainLetter).
 */
export function buildCells(
  encryptedText: string,
  hints: Hint[],
  guesses: Record<string, string>,
): Cell[] {
  const hintMap = new Map<string, string>(
    hints.map((h) => [
      h.cipherLetter.toUpperCase(),
      h.plainLetter.toUpperCase(),
    ]),
  );

  const cells: Cell[] = [];
  let editIndex = 0;

  for (let i = 0; i < encryptedText.length; i++) {
    const char = encryptedText[i];

    if (char === " ") {
      cells.push({ kind: "space", index: i });
    } else if (/[A-Z]/i.test(char)) {
      const cipherLetter = char.toUpperCase();
      const revealed = hintMap.get(cipherLetter);

      if (revealed !== undefined) {
        cells.push({
          kind: "hint",
          index: i,
          cipherLetter,
          plainLetter: revealed,
        });
      } else {
        cells.push({
          kind: "letter",
          index: i,
          editIndex: editIndex++,
          cipherLetter,
          guess: guesses[cipherLetter]?.toUpperCase() ?? null,
        });
      }
    } else {
      cells.push({ kind: "punct", index: i, char });
    }
  }

  return cells;
}

// ─── detectConflicts ────────────────────────────────────────────────────────

/**
 * Returns the set of cipher letters involved in conflicts.
 *
 * A conflict exists when two different cipher letters are both guessed
 * as the same plain letter (cryptoquip cipher is one-to-one).
 * Hint cells are included in the conflict map so user guesses that
 * collide with a hint's plain letter are also flagged.
 *
 * Example: if "X" → "E" and "Y" → "E", both "X" and "Y" are conflicts.
 * Example: if hint has "X" → "T" and the player guesses "Y" → "T", "Y" is a conflict.
 */
export function detectConflicts(
  guesses: Record<string, string>,
  hints: Hint[],
): Set<string> {
  // Build plain → Set<cipherLetter> map from user guesses
  const plainToCiphers = new Map<string, Set<string>>();

  for (const [cipher, plain] of Object.entries(guesses)) {
    if (!plain) continue;
    const upper = plain.toUpperCase();
    const existing = plainToCiphers.get(upper) ?? new Set<string>();
    existing.add(cipher);
    plainToCiphers.set(upper, existing);
  }

  // Include hints in the conflict map so user guesses that collide with hints are flagged
  hints.forEach((h) => {
    const existing = plainToCiphers.get(h.plainLetter) ?? new Set<string>();
    existing.add(h.cipherLetter);
    plainToCiphers.set(h.plainLetter, existing);
  });

  // Collect cipher letters where the plain letter is shared by 2+
  const conflicts = new Set<string>();
  for (const ciphers of plainToCiphers.values()) {
    if (ciphers.size >= 2) {
      for (const c of ciphers) conflicts.add(c);
    }
  }

  return conflicts;
}

// ─── formatTimer ────────────────────────────────────────────────────────────

/**
 * Format elapsed milliseconds as "MM:SS".
 * Caps display at 99:59 (max representable in MM:SS with two-digit minutes).
 */
export function formatTimer(elapsedMs: number): string {
  const totalSeconds = Math.floor(Math.max(0, elapsedMs) / 1000);
  const minutes = Math.min(99, Math.floor(totalSeconds / 60));
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// ─── assembleSolution ───────────────────────────────────────────────────────

/**
 * Assemble the player's full solution string from the cell array.
 *
 * Replaces each editable cell's cipher letter with the player's guess (or '?'
 * if unfilled), and each hint cell with its revealed plain letter.
 * Preserves spaces and punctuation from the original text.
 *
 * The returned string is submitted to POST /game/:id/check.
 * The server normalizes case and whitespace, so exact casing is not critical.
 */
export function assembleSolution(cells: Cell[]): string {
  return cells
    .map((cell) => {
      switch (cell.kind) {
        case "letter":
          return cell.guess ?? "?";
        case "hint":
          return cell.plainLetter;
        case "punct":
          return cell.char;
        case "space":
          return " ";
      }
    })
    .join("");
}
