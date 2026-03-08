import type { Cell } from "../puzzle";
import type { PlayerStats } from "../api";

/**
 * Format elapsed milliseconds as "M:SS" (no leading zero on minutes).
 * Matches the fmtMs() pattern used in stats/+page.svelte.
 */
function fmtMs(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export interface SessionShareData {
  puzzleNumber: string; // e.g. "42" — derived from puzzle date or ID
  solved: boolean;
  completionTime: number | null; // ms
  cells: Cell[];
  currentStreak: number | null; // null for anonymous players
}

/**
 * Build the Wordle-style letter decode grid from the cell array.
 *
 * Each letter position becomes a gold square (decoded/guessed) or white square
 * (not decoded). Spaces become actual spaces. Punctuation is omitted.
 * Lines wrap at ~30 characters to keep the grid readable in social posts.
 */
export function buildLetterGrid(cells: Cell[]): string {
  const WRAP_AT = 30;
  const GOLD = "\u{1F7E8}"; // yellow/gold square
  const WHITE = "\u2B1C"; // white square

  // Build flat array of tokens: emoji for letters/hints, space for spaces, skip punctuation
  const tokens: string[] = [];
  for (const cell of cells) {
    switch (cell.kind) {
      case "letter":
        tokens.push(cell.guess !== null ? GOLD : WHITE);
        break;
      case "hint":
        tokens.push(GOLD); // hints are always decoded
        break;
      case "space":
        tokens.push(" ");
        break;
      case "punctuation":
        // omit punctuation from grid
        break;
    }
  }

  // Join and wrap at word boundaries (~WRAP_AT chars per line)
  // Split on spaces to get "words" (runs of emoji between spaces)
  const words = tokens.join("").split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (currentLine.length === 0) {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= WRAP_AT) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines.join("\n");
}

/**
 * Format a session result as Wordle-style plain text.
 *
 * Example output:
 *   UNQUOTE #42 ✅ 2:08
 *
 *   🟨⬜🟨 🟨⬜🟨⬜🟨
 *   🟨⬜🟨🟨🟨 🟨⬜🟨
 *
 *   🔥 12-day streak
 *   playunquote.com
 */
export function formatSessionText(data: SessionShareData): string {
  const status = data.solved ? "\u2705" : "\u274C"; // ✅ or ❌
  const time =
    data.solved && data.completionTime !== null
      ? ` ${fmtMs(data.completionTime)}`
      : "";

  const header = `UNQUOTE #${data.puzzleNumber} ${status}${time}`;
  const grid = buildLetterGrid(data.cells);

  const parts = [header, "", grid];

  if (data.currentStreak !== null && data.currentStreak > 0) {
    parts.push("", `\u{1F525} ${data.currentStreak}-day streak`);
  }

  parts.push("", "playunquote.com");

  return parts.join("\n");
}

/**
 * Format overall player stats as plain text.
 *
 * Example output:
 *   UNQUOTE Stats
 *
 *   🎮 42 played · 38 solved · 90%
 *   🔥 12-day streak (best: 18)
 *   ⏱️ Best 1:42 · Avg 2:31
 *
 *   playunquote.com
 */
export function formatStatsText(stats: PlayerStats): string {
  const pct = Math.round(stats.winRate * 100);
  const played = `\u{1F3AE} ${stats.gamesPlayed} played \u00B7 ${stats.gamesSolved} solved \u00B7 ${pct}%`;
  const streak = `\u{1F525} ${stats.currentStreak}-day streak (best: ${stats.bestStreak})`;

  let times: string;
  if (stats.bestTime !== null && stats.averageTime !== null) {
    times = `\u23F1\uFE0F Best ${fmtMs(stats.bestTime)} \u00B7 Avg ${fmtMs(stats.averageTime)}`;
  } else {
    times = `\u23F1\uFE0F No solves yet`;
  }

  return [
    "UNQUOTE Stats",
    "",
    played,
    streak,
    times,
    "",
    "playunquote.com",
  ].join("\n");
}
