import { describe, it, expect } from "vitest";
import {
  buildCells,
  detectConflicts,
  formatTimer,
  assembleSolution,
} from "./puzzle";
import type { Hint } from "./api";

// ─── buildCells ────────────────────────────────────────────────────────────

describe("buildCells", () => {
  const hints: Hint[] = [{ cipherLetter: "X", plainLetter: "T" }];

  it("maps space characters to SpaceCells", () => {
    const cells = buildCells("A B", [], {});
    expect(cells[1]).toMatchObject({ kind: "space" });
  });

  it("maps punctuation to PunctCells", () => {
    const cells = buildCells("A,B", [], {});
    expect(cells[1]).toMatchObject({ kind: "punct", char: "," });
  });

  it("maps hint letters to HintCells", () => {
    const cells = buildCells("XYZ", hints, {});
    expect(cells[0]).toMatchObject({
      kind: "hint",
      cipherLetter: "X",
      plainLetter: "T",
    });
  });

  it("maps non-hint letters to LetterCells", () => {
    const cells = buildCells("YZ", hints, {});
    expect(cells[0]).toMatchObject({ kind: "letter", cipherLetter: "Y" });
  });

  it("fills guess from guesses map", () => {
    const cells = buildCells("Y", hints, { Y: "E" });
    expect(cells[0]).toMatchObject({ kind: "letter", guess: "E" });
  });

  it("sets guess to null when cipher letter not in guesses", () => {
    const cells = buildCells("Y", hints, {});
    expect(cells[0]).toMatchObject({ kind: "letter", guess: null });
  });

  it("assigns sequential editIndexes to LetterCells", () => {
    // "AB" with no hints → two LetterCells with editIndex 0, 1
    const cells = buildCells("AB", [], {});
    expect(cells[0]).toMatchObject({ kind: "letter", editIndex: 0 });
    expect(cells[1]).toMatchObject({ kind: "letter", editIndex: 1 });
  });

  it("editIndex skips HintCells", () => {
    // "XY" where X is a hint → Y is editIndex 0 (X is a HintCell, not counted)
    const cells = buildCells("XY", hints, {});
    expect(cells[0]).toMatchObject({ kind: "hint" });
    expect(cells[1]).toMatchObject({ kind: "letter", editIndex: 0 });
  });

  it("uppercases cipher letters from mixed-case input", () => {
    const cells = buildCells("abc", [], {});
    const letters = cells.filter(
      (c) => c.kind === "letter",
    ) as ((typeof cells)[number] & { kind: "letter" })[];
    expect(letters.map((l) => l.cipherLetter)).toEqual(["A", "B", "C"]);
  });

  it("handles empty string", () => {
    expect(buildCells("", [], {})).toEqual([]);
  });
});

// ─── detectConflicts ───────────────────────────────────────────────────────

describe("detectConflicts", () => {
  it("returns empty set when no guesses", () => {
    expect(detectConflicts({}, [])).toEqual(new Set());
  });

  it("returns empty set when all guesses are unique", () => {
    expect(detectConflicts({ A: "E", B: "L", C: "P" }, [])).toEqual(new Set());
  });

  it("returns both cipher letters when two map to same plain letter", () => {
    const conflicts = detectConflicts({ A: "E", B: "E" }, []);
    expect(conflicts).toEqual(new Set(["A", "B"]));
  });

  it("returns three cipher letters when three map to same plain letter", () => {
    const conflicts = detectConflicts({ A: "E", B: "E", C: "E" }, []);
    expect(conflicts).toEqual(new Set(["A", "B", "C"]));
  });

  it("handles multiple independent conflicts", () => {
    // A and B conflict on E; C and D conflict on L
    const conflicts = detectConflicts({ A: "E", B: "E", C: "L", D: "L" }, []);
    expect(conflicts).toEqual(new Set(["A", "B", "C", "D"]));
  });

  it("ignores empty guess values", () => {
    expect(detectConflicts({ A: "", B: "" }, [])).toEqual(new Set());
  });

  it("is case-insensitive for plain letters", () => {
    // 'e' and 'E' should conflict
    const conflicts = detectConflicts({ A: "e", B: "E" }, []);
    expect(conflicts).toEqual(new Set(["A", "B"]));
  });

  it("flags user guess that collides with a hint plain letter", () => {
    // Hint: X → T. If player guesses Y → T, Y conflicts with X.
    const hintList: Hint[] = [{ cipherLetter: "X", plainLetter: "T" }];
    const conflicts = detectConflicts({ Y: "T" }, hintList);
    expect(conflicts).toEqual(new Set(["X", "Y"]));
  });

  it("does not flag guesses that are unique relative to hints", () => {
    // Hint: X → T. Player guesses Y → E (different plain letter) — no conflict.
    const hintList: Hint[] = [{ cipherLetter: "X", plainLetter: "T" }];
    const conflicts = detectConflicts({ Y: "E" }, hintList);
    expect(conflicts).toEqual(new Set());
  });
});

// ─── formatTimer ───────────────────────────────────────────────────────────

describe("formatTimer", () => {
  it("formats 0ms as 00:00", () => {
    expect(formatTimer(0)).toBe("00:00");
  });

  it("formats 30 seconds", () => {
    expect(formatTimer(30_000)).toBe("00:30");
  });

  it("formats 1 minute", () => {
    expect(formatTimer(60_000)).toBe("01:00");
  });

  it("formats 1 minute 30 seconds", () => {
    expect(formatTimer(90_000)).toBe("01:30");
  });

  it("formats 10 minutes exactly", () => {
    expect(formatTimer(600_000)).toBe("10:00");
  });

  it("pads single-digit seconds", () => {
    expect(formatTimer(61_000)).toBe("01:01");
  });

  it("caps display at 99:59", () => {
    expect(formatTimer(99 * 60_000 + 59_000)).toBe("99:59");
    expect(formatTimer(100 * 60_000)).toBe("99:00");
  });

  it("treats negative input as 0", () => {
    expect(formatTimer(-5000)).toBe("00:00");
  });
});

// ─── assembleSolution ──────────────────────────────────────────────────────

describe("assembleSolution", () => {
  it("assembles filled cells into a string", () => {
    const cells = buildCells("AB", [], { A: "H", B: "I" });
    expect(assembleSolution(cells)).toBe("HI");
  });

  it("uses ? for unfilled cells", () => {
    const cells = buildCells("AB", [], { A: "H" });
    expect(assembleSolution(cells)).toBe("H?");
  });

  it("uses plain letter for hint cells", () => {
    const hints: Hint[] = [{ cipherLetter: "X", plainLetter: "T" }];
    const cells = buildCells("XB", hints, { B: "O" });
    expect(assembleSolution(cells)).toBe("TO");
  });

  it("preserves spaces", () => {
    const cells = buildCells("A B", [], { A: "H", B: "I" });
    expect(assembleSolution(cells)).toBe("H I");
  });

  it("preserves punctuation", () => {
    const cells = buildCells("A,B", [], { A: "H", B: "I" });
    expect(assembleSolution(cells)).toBe("H,I");
  });
});
