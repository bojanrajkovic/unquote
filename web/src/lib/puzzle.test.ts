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

  it("AC3.1: maps space characters to SpaceCells", () => {
    const cells = buildCells("A B", [], {});
    expect(cells[1]).toMatchObject({ kind: "space" });
  });

  it("AC3.1: maps punctuation to PunctuationCells", () => {
    const cells = buildCells("A,B", [], {});
    expect(cells[1]).toMatchObject({ kind: "punctuation", char: "," });
  });

  it("AC3.1: maps hint letters to HintCells", () => {
    const cells = buildCells("XYZ", hints, {});
    expect(cells[0]).toMatchObject({
      kind: "hint",
      cipherLetter: "X",
      plainLetter: "T",
    });
  });

  it("AC3.1: maps non-hint letters to LetterCells", () => {
    const cells = buildCells("YZ", hints, {});
    expect(cells[0]).toMatchObject({ kind: "letter", cipherLetter: "Y" });
  });

  it("AC3.1: fills guess from guesses map", () => {
    const cells = buildCells("Y", hints, { Y: "E" });
    expect(cells[0]).toMatchObject({ kind: "letter", guess: "E" });
  });

  it("AC3.1: sets guess to null when cipher letter not in guesses", () => {
    const cells = buildCells("Y", hints, {});
    expect(cells[0]).toMatchObject({ kind: "letter", guess: null });
  });

  it("AC2.1: assigns sequential editIndexes to LetterCells", () => {
    // "AB" with no hints → two LetterCells with editIndex 0, 1
    const cells = buildCells("AB", [], {});
    expect(cells[0]).toMatchObject({ kind: "letter", editIndex: 0 });
    expect(cells[1]).toMatchObject({ kind: "letter", editIndex: 1 });
  });

  it("AC2.1: editIndex skips HintCells", () => {
    // "XY" where X is a hint → Y is editIndex 0 (X is a HintCell, not counted)
    const cells = buildCells("XY", hints, {});
    expect(cells[0]).toMatchObject({ kind: "hint" });
    expect(cells[1]).toMatchObject({ kind: "letter", editIndex: 0 });
  });

  it("AC3.1: uppercases cipher letters from mixed-case input", () => {
    const cells = buildCells("abc", [], {});
    const letters = cells.filter(
      (c) => c.kind === "letter",
    ) as ((typeof cells)[number] & { kind: "letter" })[];
    expect(letters.map((l) => l.cipherLetter)).toEqual(["A", "B", "C"]);
  });

  it("AC3.1: handles empty string", () => {
    expect(buildCells("", [], {})).toEqual([]);
  });
});

// ─── detectConflicts ───────────────────────────────────────────────────────

describe("detectConflicts", () => {
  it("AC2.8: returns empty set when no guesses", () => {
    expect(detectConflicts({}, [])).toEqual(new Set());
  });

  it("AC2.8: returns empty set when all guesses are unique", () => {
    expect(detectConflicts({ A: "E", B: "L", C: "P" }, [])).toEqual(new Set());
  });

  it("AC2.8: returns both cipher letters when two map to same plain letter", () => {
    const conflicts = detectConflicts({ A: "E", B: "E" }, []);
    expect(conflicts).toEqual(new Set(["A", "B"]));
  });

  it("AC2.8: returns three cipher letters when three map to same plain letter", () => {
    const conflicts = detectConflicts({ A: "E", B: "E", C: "E" }, []);
    expect(conflicts).toEqual(new Set(["A", "B", "C"]));
  });

  it("AC2.8: handles multiple independent conflicts", () => {
    // A and B conflict on E; C and D conflict on L
    const conflicts = detectConflicts({ A: "E", B: "E", C: "L", D: "L" }, []);
    expect(conflicts).toEqual(new Set(["A", "B", "C", "D"]));
  });

  it("AC2.8: ignores empty guess values", () => {
    expect(detectConflicts({ A: "", B: "" }, [])).toEqual(new Set());
  });

  it("AC2.8: is case-insensitive for plain letters", () => {
    // 'e' and 'E' should conflict
    const conflicts = detectConflicts({ A: "e", B: "E" }, []);
    expect(conflicts).toEqual(new Set(["A", "B"]));
  });

  it("AC2.8: flags user guess that collides with a hint plain letter", () => {
    // Hint: X → T. If player guesses Y → T, Y conflicts with X.
    const hintList: Hint[] = [{ cipherLetter: "X", plainLetter: "T" }];
    const conflicts = detectConflicts({ Y: "T" }, hintList);
    expect(conflicts).toEqual(new Set(["X", "Y"]));
  });

  it("AC2.8: does not flag guesses that are unique relative to hints", () => {
    // Hint: X → T. Player guesses Y → E (different plain letter) — no conflict.
    const hintList: Hint[] = [{ cipherLetter: "X", plainLetter: "T" }];
    const conflicts = detectConflicts({ Y: "E" }, hintList);
    expect(conflicts).toEqual(new Set());
  });
});

// ─── formatTimer ───────────────────────────────────────────────────────────

describe("formatTimer", () => {
  it("AC3.2: formats 0ms as 00:00", () => {
    expect(formatTimer(0)).toBe("00:00");
  });

  it("AC3.2: formats 30 seconds", () => {
    expect(formatTimer(30_000)).toBe("00:30");
  });

  it("AC3.2: formats 1 minute", () => {
    expect(formatTimer(60_000)).toBe("01:00");
  });

  it("AC3.2: formats 1 minute 30 seconds", () => {
    expect(formatTimer(90_000)).toBe("01:30");
  });

  it("AC3.2: formats 10 minutes exactly", () => {
    expect(formatTimer(600_000)).toBe("10:00");
  });

  it("AC3.2: pads single-digit seconds", () => {
    expect(formatTimer(61_000)).toBe("01:01");
  });

  it("AC3.2: caps display at 99:59", () => {
    expect(formatTimer(99 * 60_000 + 59_000)).toBe("99:59");
    expect(formatTimer(100 * 60_000)).toBe("99:00");
  });

  it("AC3.2: treats negative input as 0", () => {
    expect(formatTimer(-5000)).toBe("00:00");
  });
});

// ─── assembleSolution ──────────────────────────────────────────────────────

describe("assembleSolution", () => {
  it("AC4.3: assembles filled cells into a string", () => {
    const cells = buildCells("AB", [], { A: "H", B: "I" });
    expect(assembleSolution(cells)).toBe("HI");
  });

  it("AC2.12: uses ? for unfilled cells", () => {
    const cells = buildCells("AB", [], { A: "H" });
    expect(assembleSolution(cells)).toBe("H?");
  });

  it("AC4.3: uses plain letter for hint cells", () => {
    const hints: Hint[] = [{ cipherLetter: "X", plainLetter: "T" }];
    const cells = buildCells("XB", hints, { B: "O" });
    expect(assembleSolution(cells)).toBe("TO");
  });

  it("AC4.3: preserves spaces", () => {
    const cells = buildCells("A B", [], { A: "H", B: "I" });
    expect(assembleSolution(cells)).toBe("H I");
  });

  it("AC4.3: preserves punctuation", () => {
    const cells = buildCells("A,B", [], { A: "H", B: "I" });
    expect(assembleSolution(cells)).toBe("H,I");
  });
});
