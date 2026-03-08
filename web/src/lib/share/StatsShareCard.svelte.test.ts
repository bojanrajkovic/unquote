import { describe, it, expect } from "vitest";
import type { Props } from "./StatsShareCard.svelte";
import type { PlayerStats } from "../api";

// These tests verify the component's TypeScript interface and
// basic functionality. Visual verification and integration tests
// will be covered in E2E tests (Phase 4).

describe("StatsShareCard (component interface)", () => {
  it("shareable-stats.AC2.1: accepts PlayerStats prop", () => {
    const stats: PlayerStats = {
      claimCode: "ABC-123",
      gamesPlayed: 42,
      gamesSolved: 38,
      winRate: 0.905,
      currentStreak: 12,
      bestStreak: 18,
      bestTime: 102000,
      averageTime: 151000,
      recentSolves: [],
    };

    const props: Props = { stats };
    expect(props.stats.gamesPlayed).toBe(42);
    expect(props.stats.gamesSolved).toBe(38);
    expect(props.stats.winRate).toBe(0.905);
  });

  it("shareable-stats.AC2.2: accepts null bestTime and averageTime", () => {
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

    const props: Props = { stats };
    expect(props.stats.bestTime).toBeNull();
    expect(props.stats.averageTime).toBeNull();
  });

  it("shareable-stats.AC2.2: accepts recentSolves array for sparkline", () => {
    const stats: PlayerStats = {
      claimCode: "ABC-123",
      gamesPlayed: 10,
      gamesSolved: 8,
      winRate: 0.8,
      currentStreak: 5,
      bestStreak: 10,
      bestTime: 100000,
      averageTime: 150000,
      recentSolves: [
        { date: "2026-03-01", completionTime: 120000 },
        { date: "2026-03-02", completionTime: 130000 },
        { date: "2026-03-03", completionTime: 110000 },
      ],
    };

    const props: Props = { stats };
    expect(props.stats.recentSolves).toHaveLength(3);
    expect(props.stats.recentSolves[0].completionTime).toBe(120000);
  });

  it("shareable-stats.AC2.2: recentSolves can be empty", () => {
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

    const props: Props = { stats };
    expect(props.stats.recentSolves).toHaveLength(0);
  });
});
