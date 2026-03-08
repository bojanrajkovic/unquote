import { describe, it, expect } from "vitest";
import {
  buildLetterGrid,
  formatSessionText,
  formatStatsText,
  type SessionShareData,
} from "./format";
import { buildCells } from "../puzzle";
import type { Hint, PlayerStats } from "../api";

// ─── buildLetterGrid ──────────────────────────────────────────────────────────

describe("buildLetterGrid", () => {
  it("shareable-stats.AC1.8: maps LetterCells with guesses to gold squares", () => {
    const cells = buildCells("HELLO", [], { H: "W", E: "O", L: "R", O: "L" });
    const grid = buildLetterGrid(cells);
    // All 5 letters are guessed, should show 5 gold squares
    expect(grid).toMatch(/🟨/g);
    const goldCount = (grid.match(/🟨/g) || []).length;
    expect(goldCount).toBe(5);
  });

  it("shareable-stats.AC1.8: maps LetterCells without guesses to white squares", () => {
    const cells = buildCells("HELLO", [], {});
    const grid = buildLetterGrid(cells);
    // No letters guessed, should show 5 white squares
    expect(grid).toMatch(/⬜/g);
    const whiteCount = (grid.match(/⬜/g) || []).length;
    expect(whiteCount).toBe(5);
  });

  it("shareable-stats.AC1.8: maps HintCells to gold squares", () => {
    const hints: Hint[] = [{ cipherLetter: "H", plainLetter: "W" }];
    const cells = buildCells("HELLO", hints, {});
    const grid = buildLetterGrid(cells);
    // First letter is a hint (gold), rest are white
    expect(grid).toContain("🟨");
    expect(grid).toContain("⬜");
  });

  it("shareable-stats.AC1.8: maps SpaceCells to spaces", () => {
    const cells = buildCells("HI THERE", [], {
      H: "W",
      I: "A",
      T: "S",
      E: "H",
      R: "O",
    });
    const grid = buildLetterGrid(cells);
    // Should contain actual spaces
    expect(grid).toContain(" ");
  });

  it("shareable-stats.AC1.8: omits PunctuationCells from grid", () => {
    const cells = buildCells("HELLO, WORLD!", [], {});
    const grid = buildLetterGrid(cells);
    // Punctuation should not appear in grid
    expect(grid).not.toContain(",");
    expect(grid).not.toContain("!");
  });

  it("shareable-stats.AC1.8: wraps grid at word boundaries (~30 chars)", () => {
    // Create a long phrase that should wrap
    const longPhrase =
      "THIS IS A VERY LONG SENTENCE THAT SHOULD WRAP AT BOUNDARIES";
    const cells = buildCells(longPhrase, [], {});
    const grid = buildLetterGrid(cells);
    const lines = grid.split("\n");
    // Should have multiple lines due to wrapping
    expect(lines.length).toBeGreaterThan(1);
    // Each line should be roughly under the wrap limit
    for (const line of lines) {
      // Emoji are 2 bytes each in UTF-16, but still need reasonable line length
      expect(line.length).toBeLessThan(100);
    }
  });

  it("returns empty string for empty cells array", () => {
    const grid = buildLetterGrid([]);
    expect(grid).toBe("");
  });

  it("shareable-stats.AC1.8: correctly represents word boundaries", () => {
    const cells = buildCells("HI THERE", [], {
      H: "W",
      I: "A",
      T: "S",
      E: "H",
      R: "O",
    });
    const grid = buildLetterGrid(cells);
    // Should have: word (HI) + space + word (THERE)
    expect(grid).toMatch(/🟨.*🟨.*\s.*🟨/);
  });
});

// ─── formatSessionText ──────────────────────────────────────────────────────────

describe("formatSessionText", () => {
  it("shareable-stats.AC1.3: includes puzzle number and success status in header", () => {
    const data: SessionShareData = {
      puzzleNumber: "42",
      solved: true,
      completionTime: 128000, // 2:08
      cells: buildCells("HELLO", [], { H: "W", E: "O", L: "R", O: "L" }),
      currentStreak: 12,
    };
    const text = formatSessionText(data);
    expect(text).toContain("UNQUOTE #42");
    expect(text).toContain("✅");
  });

  it("shareable-stats.AC1.3: includes completion time when solved", () => {
    const data: SessionShareData = {
      puzzleNumber: "42",
      solved: true,
      completionTime: 128000, // 2:08
      cells: buildCells("HELLO", [], {}),
      currentStreak: 12,
    };
    const text = formatSessionText(data);
    expect(text).toContain("2:08");
  });

  it("shareable-stats.AC1.3: includes letter grid in output", () => {
    const data: SessionShareData = {
      puzzleNumber: "42",
      solved: true,
      completionTime: 128000,
      cells: buildCells("HELLO", [], { H: "W", E: "O" }),
      currentStreak: 12,
    };
    const text = formatSessionText(data);
    expect(text).toContain("🟨");
  });

  it("shareable-stats.AC1.3: includes footer URL", () => {
    const data: SessionShareData = {
      puzzleNumber: "42",
      solved: true,
      completionTime: 128000,
      cells: buildCells("HELLO", [], {}),
      currentStreak: 12,
    };
    const text = formatSessionText(data);
    expect(text).toContain("playunquote.com");
  });

  it("shareable-stats.AC1.3: includes streak information when streak > 0", () => {
    const data: SessionShareData = {
      puzzleNumber: "42",
      solved: true,
      completionTime: 128000,
      cells: buildCells("HELLO", [], {}),
      currentStreak: 12,
    };
    const text = formatSessionText(data);
    expect(text).toContain("🔥");
    expect(text).toContain("12-day streak");
  });

  it("omits streak line when currentStreak is null (anonymous player)", () => {
    const data: SessionShareData = {
      puzzleNumber: "42",
      solved: true,
      completionTime: 128000,
      cells: buildCells("HELLO", [], {}),
      currentStreak: null,
    };
    const text = formatSessionText(data);
    expect(text).not.toContain("🔥");
    expect(text).not.toContain("day streak");
  });

  it("omits streak line when currentStreak is 0", () => {
    const data: SessionShareData = {
      puzzleNumber: "42",
      solved: true,
      completionTime: 128000,
      cells: buildCells("HELLO", [], {}),
      currentStreak: 0,
    };
    const text = formatSessionText(data);
    expect(text).not.toContain("🔥");
    expect(text).not.toContain("day streak");
  });

  it("shows cross mark emoji for unsolved puzzles", () => {
    const data: SessionShareData = {
      puzzleNumber: "42",
      solved: false,
      completionTime: null,
      cells: buildCells("HELLO", [], {}),
      currentStreak: 5,
    };
    const text = formatSessionText(data);
    expect(text).toContain("❌");
    expect(text).not.toContain("✅");
  });

  it("omits time from header for unsolved puzzles", () => {
    const data: SessionShareData = {
      puzzleNumber: "42",
      solved: false,
      completionTime: 128000,
      cells: buildCells("HELLO", [], {}),
      currentStreak: 5,
    };
    const text = formatSessionText(data);
    expect(text).toContain("UNQUOTE #42 ❌");
    expect(text).not.toContain("2:08");
  });
});

// ─── formatStatsText ────────────────────────────────────────────────────────────

describe("formatStatsText", () => {
  it("shareable-stats.AC2.3: includes games played, solved count, and win rate", () => {
    const stats: PlayerStats = {
      claimCode: "ABC123",
      gamesPlayed: 42,
      gamesSolved: 38,
      winRate: 0.905,
      currentStreak: 12,
      bestStreak: 18,
      bestTime: 102000,
      averageTime: 151000,
      recentSolves: [],
    };
    const text = formatStatsText(stats);
    expect(text).toContain("🎮");
    expect(text).toContain("42 played");
    expect(text).toContain("38 solved");
    expect(text).toContain("91%"); // rounded from 90.5%
  });

  it("shareable-stats.AC2.3: includes streak information", () => {
    const stats: PlayerStats = {
      claimCode: "ABC123",
      gamesPlayed: 42,
      gamesSolved: 38,
      winRate: 0.905,
      currentStreak: 12,
      bestStreak: 18,
      bestTime: 102000,
      averageTime: 151000,
      recentSolves: [],
    };
    const text = formatStatsText(stats);
    expect(text).toContain("🔥");
    expect(text).toContain("12-day streak");
    expect(text).toContain("best: 18");
  });

  it("shareable-stats.AC2.3: includes best and average times", () => {
    const stats: PlayerStats = {
      claimCode: "ABC123",
      gamesPlayed: 42,
      gamesSolved: 38,
      winRate: 0.905,
      currentStreak: 12,
      bestStreak: 18,
      bestTime: 102000,
      averageTime: 151000,
      recentSolves: [],
    };
    const text = formatStatsText(stats);
    expect(text).toContain("⏱️");
    expect(text).toContain("Best 1:42");
    expect(text).toContain("Avg 2:31");
  });

  it("shareable-stats.AC2.6: handles null bestTime and averageTime gracefully", () => {
    const stats: PlayerStats = {
      claimCode: "ABC123",
      gamesPlayed: 5,
      gamesSolved: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      bestTime: null,
      averageTime: null,
      recentSolves: [],
    };
    const text = formatStatsText(stats);
    expect(text).toContain("No solves yet");
    expect(text).toContain("⏱️");
  });

  it("includes footer URL", () => {
    const stats: PlayerStats = {
      claimCode: "ABC123",
      gamesPlayed: 42,
      gamesSolved: 38,
      winRate: 0.905,
      currentStreak: 12,
      bestStreak: 18,
      bestTime: 102000,
      averageTime: 151000,
      recentSolves: [],
    };
    const text = formatStatsText(stats);
    expect(text).toContain("playunquote.com");
  });

  it("includes UNQUOTE Stats header", () => {
    const stats: PlayerStats = {
      claimCode: "ABC123",
      gamesPlayed: 42,
      gamesSolved: 38,
      winRate: 0.905,
      currentStreak: 12,
      bestStreak: 18,
      bestTime: 102000,
      averageTime: 151000,
      recentSolves: [],
    };
    const text = formatStatsText(stats);
    expect(text).toContain("UNQUOTE Stats");
  });

  it("handles win rate rounding correctly", () => {
    const stats: PlayerStats = {
      claimCode: "ABC123",
      gamesPlayed: 100,
      gamesSolved: 95,
      winRate: 0.951, // should round to 95%
      currentStreak: 5,
      bestStreak: 10,
      bestTime: 100000,
      averageTime: 150000,
      recentSolves: [],
    };
    const text = formatStatsText(stats);
    expect(text).toContain("95%");
  });
});
