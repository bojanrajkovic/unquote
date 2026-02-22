/**
 * Game state — puzzle data, guesses, timer, and solve status.
 *
 * The state is persisted to localStorage on every mutation so the puzzle
 * resumes correctly across page reloads.
 *
 * Use the exported `game` singleton in the game screen and load functions.
 */

import { browser } from "$app/environment";
import {
  STORAGE_KEYS,
  storageGetJson,
  storageSetJson,
  storageRemove,
} from "../storage";
import { buildCells, detectConflicts } from "../puzzle";
import type { PuzzleResponse } from "../api";
import type { Cell } from "../puzzle";

// ─── Stored puzzle state ───────────────────────────────────────────────────

/**
 * The subset of game state persisted to localStorage.
 * Keyed by `date` so a new day's puzzle automatically replaces the old one.
 */
export interface StoredPuzzleState {
  /** ISO date "YYYY-MM-DD" — discriminator for stale detection */
  date: string;
  puzzleId: string;
  /** Full puzzle data to avoid re-fetching on same-day reload */
  puzzle: {
    id: string;
    encryptedText: string;
    hints: Array<{ cipherLetter: string; plainLetter: string }>;
    author: string;
    category: string;
    difficulty: number;
  };
  guesses: Record<string, string>; // cipherLetter → plainLetter
  startTime: number | null; // epoch ms, for timer resume
  status: "playing" | "solved";
}

// ─── Game status type ──────────────────────────────────────────────────────

export type GameStatus = "idle" | "playing" | "checking" | "solved" | "error";

// ─── GameState class ───────────────────────────────────────────────────────

class GameState {
  // ── Core state ────────────────────────────────────────────────────────

  puzzle = $state<PuzzleResponse | null>(null);
  guesses = $state<Record<string, string>>({});
  startTime = $state<number | null>(null);
  status = $state<GameStatus>("idle");
  cursorEditIdx = $state(0);
  errorMessage = $state<string | null>(null);

  // ── Derived state ─────────────────────────────────────────────────────

  /** Full cell array built from puzzle + guesses. Recomputed on every guess change. */
  cells = $derived<Cell[]>(
    this.puzzle
      ? buildCells(this.puzzle.encryptedText, this.puzzle.hints, this.guesses)
      : [],
  );

  /** Only the editable (letter-kind) cells. Used for cursor navigation. */
  editables = $derived(
    this.cells.filter(
      (c): c is Cell & { kind: "letter" } => c.kind === "letter",
    ),
  );

  /** Fraction of editable cells filled: 0–1. */
  progress = $derived(
    this.editables.length > 0
      ? this.editables.filter((c) => c.guess !== null).length /
          this.editables.length
      : 0,
  );

  /** Set of cipher letters involved in conflicts (includes hint cells). */
  conflicts = $derived(detectConflicts(this.guesses, this.puzzle?.hints ?? []));

  // ── Initialization ────────────────────────────────────────────────────

  /**
   * Load a puzzle into state. Called by the /game load function.
   *
   * If `stored` is provided and its date matches `puzzle.date`, resumes
   * from stored guesses/timer/status. Otherwise starts fresh.
   */
  load(puzzle: PuzzleResponse, stored: StoredPuzzleState | null): void {
    this.puzzle = puzzle;

    if (
      stored &&
      stored.date === puzzle.date &&
      stored.puzzleId === puzzle.id
    ) {
      // Same day — resume
      this.guesses = stored.guesses;
      this.startTime = stored.startTime;
      this.status = stored.status;
    } else {
      // New day or no stored state — start fresh
      this.guesses = {};
      this.startTime = Date.now();
      this.status = "playing";
      this._persist();
    }

    this.cursorEditIdx = 0;
    this.errorMessage = null;
  }

  // ── Mutations ─────────────────────────────────────────────────────────

  /** Set a guess for a cipher letter and persist. */
  setGuess(cipherLetter: string, plainLetter: string): void {
    this.guesses = { ...this.guesses, [cipherLetter]: plainLetter };
    this._persist();
  }

  /** Clear a guess for a cipher letter. */
  clearGuess(cipherLetter: string): void {
    const next = { ...this.guesses };
    delete next[cipherLetter];
    this.guesses = next;
    this._persist();
  }

  /** Clear all guesses. */
  clearAll(): void {
    this.guesses = {};
    this._persist();
  }

  /** Move the cursor to a specific edit index. */
  setCursor(editIdx: number): void {
    this.cursorEditIdx = Math.max(
      0,
      Math.min(editIdx, this.editables.length - 1),
    );
  }

  /** Mark the game as solved. Persists solved status. */
  markSolved(): void {
    this.status = "solved";
    this._persist();
  }

  /** Set an error message visible to the player. Clears after the next guess. */
  setError(message: string): void {
    this.errorMessage = message;
    this.status = "playing";
  }

  /** Clear the current error message. */
  clearError(): void {
    this.errorMessage = null;
  }

  /** Reset all state (used when navigating away from game). */
  reset(): void {
    this.puzzle = null;
    this.guesses = {};
    this.startTime = null;
    this.status = "idle";
    this.cursorEditIdx = 0;
    this.errorMessage = null;
  }

  // ── localStorage persistence ───────────────────────────────────────────

  private _persist(): void {
    if (!browser || !this.puzzle) return;

    const stored: StoredPuzzleState = {
      date: this.puzzle.date,
      puzzleId: this.puzzle.id,
      puzzle: {
        id: this.puzzle.id,
        encryptedText: this.puzzle.encryptedText,
        hints: this.puzzle.hints,
        author: this.puzzle.author,
        category: this.puzzle.category,
        difficulty: this.puzzle.difficulty,
      },
      guesses: this.guesses,
      startTime: this.startTime,
      status: this.status === "solved" ? "solved" : "playing",
    };

    storageSetJson(STORAGE_KEYS.PUZZLE, stored);
  }

  // ── Helpers for load functions ─────────────────────────────────────────

  /**
   * Read stored puzzle state from localStorage.
   * Returns null if nothing is stored or if stored data is for a different day.
   */
  static readStored(today: string): StoredPuzzleState | null {
    if (!browser) return null;
    const stored = storageGetJson<StoredPuzzleState>(STORAGE_KEYS.PUZZLE);
    if (!stored || stored.date !== today) return null;
    return stored;
  }

  /** Clear stored puzzle state from localStorage. */
  static clearStored(): void {
    if (browser) storageRemove(STORAGE_KEYS.PUZZLE);
  }
}

export const game = new GameState();

export { GameState };
