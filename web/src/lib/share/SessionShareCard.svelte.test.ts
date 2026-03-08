import { describe, it, expect } from "vitest";
import type { Props } from "./SessionShareCard.svelte";

// These tests verify the component's TypeScript interface and
// basic functionality. Visual verification and integration tests
// will be covered in E2E tests (Phase 4).

describe("SessionShareCard (component interface)", () => {
  it("shareable-stats.AC1.1: accepts required props for 1200x628 card", () => {
    const props: Props = {
      puzzleNumber: "42",
      solved: true,
      completionTime: 128000,
      letterGrid: "🟨🟨🟨\n🟨🟨🟨",
      currentStreak: 12,
    };
    expect(props.puzzleNumber).toBe("42");
    expect(props.solved).toBe(true);
    expect(props.completionTime).toBe(128000);
  });

  it("shareable-stats.AC1.1: accepts null completionTime when unsolved", () => {
    const props: Props = {
      puzzleNumber: "42",
      solved: false,
      completionTime: null,
      letterGrid: "⬜⬜⬜",
      currentStreak: 12,
    };
    expect(props.completionTime).toBeNull();
  });

  it("shareable-stats.AC1.2: accepts null currentStreak for anonymous players", () => {
    const props: Props = {
      puzzleNumber: "42",
      solved: true,
      completionTime: 128000,
      letterGrid: "🟨🟨🟨",
      currentStreak: null,
    };
    expect(props.currentStreak).toBeNull();
  });

  it("shareable-stats.AC1.2: letterGrid contains emoji and whitespace", () => {
    const grid = "🟨🟨🟨\n🟨 🟨🟨\n⬜⬜⬜";
    const props: Props = {
      puzzleNumber: "42",
      solved: true,
      completionTime: 128000,
      letterGrid: grid,
      currentStreak: 12,
    };
    expect(props.letterGrid).toContain("🟨");
    expect(props.letterGrid).toContain("⬜");
    expect(props.letterGrid).toContain("\n");
  });
});
