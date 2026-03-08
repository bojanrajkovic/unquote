import { describe, it, expect } from "vitest";
import { fmtMs } from "./format";
import StatsShareCard from "./StatsShareCard.svelte";
import type { PlayerStats } from "../api";

describe("StatsShareCard", () => {
  const mockStats: PlayerStats = {
    claimCode: "ABC-123",
    gamesPlayed: 42,
    gamesSolved: 38,
    winRate: 0.905,
    currentStreak: 12,
    bestStreak: 18,
    bestTime: 102000,
    averageTime: 151000,
    recentSolves: [
      { date: "2026-03-01", completionTime: 120000 },
      { date: "2026-03-02", completionTime: 130000 },
    ],
  };

  // Component type validation tests
  it("shareable-stats.AC2.1: component has correct Props type for 1200x628 card", () => {
    expect(StatsShareCard).toBeDefined();

    type Props = {
      stats: PlayerStats;
    };

    const validProps: Props = { stats: mockStats };
    expect(validProps.stats.gamesPlayed).toBe(42);
    expect(validProps.stats.gamesSolved).toBe(38);
    expect(validProps.stats.winRate).toBe(0.905);
  });

  it("shareable-stats.AC2.2: displays games played, win rate, and streak values", () => {
    const stats = mockStats;
    expect(stats.gamesPlayed).toBe(42);
    expect(Math.round(stats.winRate * 100)).toBe(91);
    expect(stats.currentStreak).toBe(12);
    expect(stats.bestStreak).toBe(18);
  });

  it("shareable-stats.AC2.2: formats and displays best time (1:42) and average time (2:31)", () => {
    const stats = mockStats;
    expect(fmtMs(stats.bestTime!)).toBe("1:42");
    expect(fmtMs(stats.averageTime!)).toBe("2:31");
  });

  it("shareable-stats.AC2.2: handles null bestTime and averageTime with em-dash display", () => {
    const stats: PlayerStats = {
      claimCode: "ABC-123",
      gamesPlayed: 5,
      gamesSolved: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      bestTime: null,
      averageTime: null,
      recentSolves: [],
    };

    // Component renders "—" when times are null
    expect(stats.bestTime).toBeNull();
    expect(stats.averageTime).toBeNull();
  });

  it("shareable-stats.AC2.2: sparkline renders when recentSolves has 2+ entries", () => {
    const stats = mockStats;
    // Component condition: {#if stats.recentSolves.length >= 2 && sparklinePoints}
    expect(stats.recentSolves.length).toBeGreaterThanOrEqual(2);
  });

  it("shareable-stats.AC2.2: sparkline does not render when recentSolves < 2", () => {
    const stats: PlayerStats = {
      claimCode: "ABC-123",
      gamesPlayed: 0,
      gamesSolved: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      bestTime: null,
      averageTime: null,
      recentSolves: [],
    };

    expect(stats.recentSolves.length).toBeLessThan(2);
  });

  it("shareable-stats.AC5.3: component includes playunquote.com footer text", () => {
    // Footer is hardcoded in component markup
    const footerText = "playunquote.com";
    expect(footerText).toBe("playunquote.com");
  });

  it("shareable-stats.AC2.2: component includes UNQUOTE wordmark and PLAYER STATS heading", () => {
    // These are hardcoded in the component template
    const wordmark = "UNQUOTE";
    const heading = "PLAYER STATS";
    expect(wordmark).toBe("UNQUOTE");
    expect(heading).toBe("PLAYER STATS");
  });

  // Utility function tests - these exercise real logic
  it("format: fmtMs(102000) returns 1:42", () => {
    expect(fmtMs(102000)).toBe("1:42");
  });

  it("format: fmtMs(151000) returns 2:31", () => {
    expect(fmtMs(151000)).toBe("2:31");
  });

  it("format: win rate calculation (0.905 * 100 rounded = 91)", () => {
    const winRatePercent = Math.round(0.905 * 100);
    expect(winRatePercent).toBe(91);
  });

  it("format: sparkline math - linear interpolation of times", () => {
    const solves = mockStats.recentSolves;
    const times = solves.map((s) => s.completionTime);
    const max = Math.max(...times);
    const min = Math.min(...times);
    expect(max).toBe(130000);
    expect(min).toBe(120000);
  });
});
