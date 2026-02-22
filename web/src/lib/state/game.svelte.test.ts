import { describe, it, expect, beforeEach } from "vitest";

import { game, GameState } from "./game.svelte";
import type { StoredPuzzleState } from "./game.svelte";
import { STORAGE_KEYS, storageGetJson } from "../storage";
import type { PuzzleResponse } from "../api";

const mockPuzzle: PuzzleResponse = {
  id: "game-123",
  date: "2026-02-21",
  encryptedText: "HELLO WORLD",
  author: "Test Author",
  category: "test",
  difficulty: 50,
  hints: [],
};

describe("GameState", () => {
  beforeEach(() => {
    game.reset();
    localStorage.clear();
    // Load a fresh puzzle so most tests have a puzzle in state
    game.load(mockPuzzle, null);
  });

  describe("setGuess()", () => {
    it("adds a guess to state", () => {
      game.setGuess("H", "A");
      expect(game.guesses["H"]).toBe("A");
    });

    it("persists guesses to localStorage", () => {
      game.setGuess("H", "A");
      const stored = storageGetJson<StoredPuzzleState>(STORAGE_KEYS.PUZZLE);
      expect(stored?.guesses["H"]).toBe("A");
    });
  });

  describe("clearAll()", () => {
    it("removes all guesses from state", () => {
      game.setGuess("H", "A");
      game.setGuess("E", "B");
      game.clearAll();
      expect(Object.keys(game.guesses)).toHaveLength(0);
    });

    it("persists empty guesses to localStorage", () => {
      game.setGuess("H", "A");
      game.clearAll();
      const stored = storageGetJson<StoredPuzzleState>(STORAGE_KEYS.PUZZLE);
      expect(stored?.guesses).toEqual({});
    });
  });

  describe("markSolved()", () => {
    it("sets status to solved", () => {
      game.markSolved();
      expect(game.status).toBe("solved");
    });

    it("persists solved status to localStorage", () => {
      game.markSolved();
      const stored = storageGetJson<StoredPuzzleState>(STORAGE_KEYS.PUZZLE);
      expect(stored?.status).toBe("solved");
    });
  });

  describe("load() — resume from stored state", () => {
    it("restores guesses when stored date and puzzleId match", () => {
      const stored: StoredPuzzleState = {
        date: "2026-02-21",
        puzzleId: "game-123",
        guesses: { H: "A", E: "B" },
        startTime: 12345,
        status: "playing",
      };
      game.reset();
      game.load(mockPuzzle, stored);
      expect(game.guesses).toEqual({ H: "A", E: "B" });
    });

    it("restores startTime from stored state", () => {
      const stored: StoredPuzzleState = {
        date: "2026-02-21",
        puzzleId: "game-123",
        guesses: {},
        startTime: 99999,
        status: "playing",
      };
      game.reset();
      game.load(mockPuzzle, stored);
      expect(game.startTime).toBe(99999);
    });

    it("starts fresh when stored date does not match", () => {
      const stale: StoredPuzzleState = {
        date: "2026-02-20", // yesterday
        puzzleId: "game-999",
        guesses: { H: "X" },
        startTime: 1000,
        status: "playing",
      };
      game.reset();
      game.load(mockPuzzle, stale);
      expect(Object.keys(game.guesses)).toHaveLength(0);
    });

    it("starts fresh when stored is null", () => {
      game.reset();
      game.load(mockPuzzle, null);
      expect(Object.keys(game.guesses)).toHaveLength(0);
      expect(game.status).toBe("playing");
    });

    it("sets startTime when starting fresh", () => {
      game.reset();
      game.load(mockPuzzle, null);
      expect(game.startTime).not.toBeNull();
    });
  });

  describe("GameState.readStored()", () => {
    it("returns null when localStorage is empty", () => {
      localStorage.clear();
      expect(GameState.readStored("2026-02-21")).toBeNull();
    });

    it("returns stored state when date matches", () => {
      game.setGuess("H", "A");
      const result = GameState.readStored("2026-02-21");
      expect(result).not.toBeNull();
      expect(result?.date).toBe("2026-02-21");
      expect(result?.guesses["H"]).toBe("A");
    });

    it("returns null when stored date does not match the requested date", () => {
      game.setGuess("H", "A"); // persists with date '2026-02-21'
      expect(GameState.readStored("2026-02-22")).toBeNull();
    });
  });
});
