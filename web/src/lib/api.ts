/**
 * Typed HTTP client wrapping the Unquote REST API.
 *
 * Base URL is configured via VITE_API_URL at build time.
 * Errors throw Error with a user-readable message.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// ─── Response types ────────────────────────────────────────────────────────

export interface Hint {
  cipherLetter: string; // uppercase, e.g. "X"
  plainLetter: string; // uppercase, e.g. "T"
}

export interface PuzzleResponse {
  id: string; // opaque game ID for solution checking
  date: string; // ISO date "YYYY-MM-DD"
  encryptedText: string; // encrypted quote (uppercase letters + original punctuation)
  author: string;
  category: string;
  difficulty: number; // 0–100
  hints: Hint[]; // pre-revealed letter mappings
}

export interface CheckResult {
  correct: boolean;
}

export interface CreatePlayerResult {
  claimCode: string; // e.g. "BRAVE-LION-1234"
}

export interface RecentSolve {
  date: string; // ISO date "YYYY-MM-DD"
  completionTime: number; // milliseconds
}

export interface PlayerStats {
  claimCode: string;
  gamesPlayed: number;
  gamesSolved: number;
  winRate: number; // 0–1
  currentStreak: number;
  bestStreak: number;
  bestTime: number | null; // milliseconds, null if no solves
  averageTime: number | null; // milliseconds, null if no solves
  recentSolves: RecentSolve[]; // last 30 days, ascending by date
}

// ─── Fetch helpers ─────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    let message = `API error ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.message === "string") message = body.message;
    } catch {
      // ignore parse failure — use default message
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

// ─── API functions ─────────────────────────────────────────────────────────

/** Fetch today's puzzle. Throws on network or API error. */
export function getToday(): Promise<PuzzleResponse> {
  return apiFetch<PuzzleResponse>("/game/today");
}

/**
 * Submit the player's solution for checking.
 * `id` is the opaque game ID from PuzzleResponse.
 * `solution` is the player's decoded plaintext (case-insensitive, whitespace-normalized by server).
 */
export function checkSolution(
  id: string,
  solution: string,
): Promise<CheckResult> {
  return apiFetch<CheckResult>(`/game/${id}/check`, {
    method: "POST",
    body: JSON.stringify({ solution }),
  });
}

/** Register a new anonymous player. Returns a claim code. */
export function registerPlayer(): Promise<CreatePlayerResult> {
  return apiFetch<CreatePlayerResult>("/player", { method: "POST" });
}

/**
 * Fetch stats for a registered player.
 * Only called when the player has a claim code.
 */
export function getStats(claimCode: string): Promise<PlayerStats> {
  return apiFetch<PlayerStats>(`/player/${claimCode}/stats`);
}

/**
 * Record a completed game session for a registered player.
 * `completionTime` is the solve time in milliseconds.
 * Fire-and-forget from the game screen — failures are silently ignored
 * (a stats recording failure must never block the player from seeing the solved card).
 */
export function recordSession(
  claimCode: string,
  gameId: string,
  completionTime: number,
): Promise<void> {
  return apiFetch<void>(`/player/${claimCode}/session`, {
    method: "POST",
    body: JSON.stringify({ gameId, completionTime }),
  });
}
