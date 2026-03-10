export { test, expect } from "@playwright/test";

import type { Page } from "@playwright/test";

export const MOCK_CLAIM_CODE = "TEST-CODE-1234";

export const MOCK_STATS = {
  claimCode: MOCK_CLAIM_CODE,
  gamesPlayed: 42,
  gamesSolved: 38,
  winRate: 0.9,
  currentStreak: 12,
  bestStreak: 18,
  bestTime: 102000,
  averageTime: 151000,
  recentSolves: [
    { date: "2026-03-01", completionTime: 120000 },
    { date: "2026-03-02", completionTime: 130000 },
    { date: "2026-03-03", completionTime: 110000 },
  ],
};

/**
 * Known cipher mapping for "HELLO WORLD":
 *   Cipher: X B C C D   F D G C A
 *   Plain:  H E L L O   W O R L D
 *
 * Unique cipher letters: A, B, C, D, F, G, X (7 letters)
 * Hint reveals: X → H
 * Player must fill: A→D, B→E, C→L, D→O, F→W, G→R (6 letters)
 */
export const MOCK_PUZZLE = {
  id: "test-game-id",
  date: "2026-03-07",
  encryptedText: "XBCCD FDGCA",
  author: "Test Author",
  category: "Test",
  difficulty: 25,
  hints: [{ cipherLetter: "X", plainLetter: "H" }],
};

/** Cipher-to-plain mapping for MOCK_PUZZLE. Used by full-solve test. */
export const MOCK_CIPHER_MAP: Record<string, string> = {
  X: "H",
  B: "E",
  C: "L",
  D: "O",
  F: "W",
  G: "R",
  A: "D",
};

export const MOCK_SOLVED_STATE = {
  date: MOCK_PUZZLE.date,
  puzzleId: MOCK_PUZZLE.id,
  puzzle: MOCK_PUZZLE,
  guesses: Object.fromEntries(
    Object.entries(MOCK_CIPHER_MAP).filter(
      ([cipher]) => !MOCK_PUZZLE.hints.some((h) => h.cipherLetter === cipher),
    ),
  ),
  startTime: Date.now() - 128000,
  completionTime: 128000,
  status: "solved" as const,
};

interface SeedOptions {
  onboarded?: boolean;
  claimCode?: string | null;
  puzzleState?: Record<string, unknown> | null;
}

/**
 * Seeds localStorage with identity and puzzle state.
 * Must be called after an initial page.goto("/") to establish the origin.
 */
export async function seedLocalStorage(
  page: Page,
  options: SeedOptions = {},
): Promise<void> {
  const {
    onboarded = true,
    claimCode = MOCK_CLAIM_CODE,
    puzzleState = null,
  } = options;

  await page.evaluate(
    ({ onboarded, claimCode, puzzleState }) => {
      if (onboarded) {
        localStorage.setItem("unquote_has_onboarded", "true");
      }
      if (claimCode) {
        localStorage.setItem("unquote_claim_code", claimCode);
      }
      if (puzzleState) {
        localStorage.setItem("unquote_puzzle", JSON.stringify(puzzleState));
      }
    },
    { onboarded, claimCode, puzzleState },
  );
}

interface MockApiOptions {
  puzzle?: object | null;
  stats?: object | null;
  checkResult?: { correct: boolean } | null;
  session?: object | null;
  registerResult?: { claimCode: string } | null;
  sessionNotFound?: boolean;
}

/**
 * Sets up page.route() mocks for API endpoints.
 * Pass null or omit an option to skip mocking that endpoint.
 * Set sessionNotFound to true to return 404 for session lookups.
 */
export async function mockApi(
  page: Page,
  options: MockApiOptions = {},
): Promise<void> {
  const {
    puzzle = MOCK_PUZZLE,
    stats = null,
    checkResult = null,
    session = null,
    registerResult = null,
    sessionNotFound = false,
  } = options;

  if (puzzle) {
    await page.route("**/game/today", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(puzzle),
      }),
    );
  }

  if (stats) {
    await page.route("**/player/*/stats", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(stats),
      }),
    );
  }

  if (checkResult) {
    await page.route("**/game/*/check", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(checkResult),
      }),
    );
  }

  if (session) {
    await page.route("**/player/*/session/*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(session),
      }),
    );
  } else if (sessionNotFound) {
    await page.route("**/player/*/session/*", (route) =>
      route.fulfill({ status: 404 }),
    );
  }

  if (registerResult) {
    await page.route("**/player", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(registerResult),
        });
      }
      return route.continue();
    });
  }
}

/**
 * Captures an informational screenshot at a key state.
 * Waits for fonts to load and all finite Web Animations (Svelte fly/fade
 * transitions) to complete before capture.
 *
 * Svelte 5 transitions use element.animate() (Web Animations API), which
 * is unaffected by Playwright's animations:"disabled" CSS override.
 * We poll getAnimations() instead of awaiting .finished promises because
 * Svelte's animation lifecycle can leave promises unresolved.
 */
export async function captureScreenshot(
  page: Page,
  filename: string,
): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(
    () => {
      const running = document.getAnimations().filter((a) => {
        if (a.playState !== "running") return false;
        const t = a.effect?.getComputedTiming();
        return t != null && Number.isFinite(t.endTime);
      });
      return running.length === 0;
    },
    null,
    { timeout: 5000 },
  );
  await page.screenshot({ path: `test-results/${filename}`, fullPage: true });
}
