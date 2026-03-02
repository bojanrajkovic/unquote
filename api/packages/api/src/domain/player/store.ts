import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DateTime } from "luxon";
import { players, gameSessions } from "./schema.js";
import { generateClaimCode } from "./claim-code.js";
import type { PlayerStats } from "./types.js";
import { PlayerNotFoundError } from "./types.js";
import { decodeGameId } from "../game/game-id.js";

type SessionRow = { gameId: string; completionTime: number; solvedAt: Date };

/**
 * Calculate current and best consecutive-day streaks from an array of UTC date strings.
 * Dates must be sorted ascending in YYYY-MM-DD format with no duplicates.
 *
 * @param dates - Sorted ascending array of UTC date strings (YYYY-MM-DD)
 * @returns Object containing currentStreak and bestStreak counts
 */
export function calculateStreaks(dates: string[]): { currentStreak: number; bestStreak: number } {
  if (dates.length === 0) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  let bestStreak = 1;
  let runLength = 1;

  for (let i = 1; i < dates.length; i++) {
    const prevDate = dates[i - 1];
    const currDate = dates[i];
    if (!prevDate || !currDate) {
      continue;
    }

    const prev = DateTime.fromISO(prevDate, { zone: "utc" });
    const curr = DateTime.fromISO(currDate, { zone: "utc" });
    const diffDays = curr.diff(prev, "days").days;

    if (diffDays === 1) {
      runLength++;
    } else {
      runLength = 1;
    }

    bestStreak = Math.max(bestStreak, runLength);
  }

  // Current streak: count backwards from today (UTC)
  const today = DateTime.utc().toISODate();
  const yesterday = DateTime.utc().minus({ days: 1 }).toISODate();
  const lastSolveDate = dates.at(-1);
  let currentStreak: number;

  if (!lastSolveDate || (lastSolveDate !== today && lastSolveDate !== yesterday)) {
    currentStreak = 0;
  } else {
    currentStreak = 1;
    for (let i = dates.length - 2; i >= 0; i--) {
      const currDate = dates[i + 1];
      const prevDate = dates[i];
      if (!currDate || !prevDate) {
        break;
      }

      const curr = DateTime.fromISO(currDate, { zone: "utc" });
      const prev = DateTime.fromISO(prevDate, { zone: "utc" });
      const diffDays = curr.diff(prev, "days").days;

      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return { currentStreak, bestStreak };
}

/**
 * PostgreSQL implementation of the PlayerStore interface.
 * Uses Drizzle ORM for type-safe queries against the player schema.
 */
export class PgPlayerStore {
  constructor(private readonly db: NodePgDatabase) {}

  /**
   * Create a new player with a unique claim code.
   * Retries up to 5 times on unique constraint collision.
   */
  async createPlayer(): Promise<{ claimCode: string }> {
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const claimCode = generateClaimCode();
      const result = await this.db
        .insert(players)
        .values({ claimCode })
        .onConflictDoNothing({ target: players.claimCode })
        .returning({ claimCode: players.claimCode });

      const inserted = result[0];
      if (inserted) {
        return { claimCode: inserted.claimCode };
      }
      // Collision — retry with a new code
    }
    throw new Error("failed to generate unique claim code after maximum retries");
  }

  /**
   * Record a game session for a player identified by their claim code.
   * Returns "created" for new sessions, "exists" for already-recorded ones.
   * Throws PlayerNotFoundError if the claim code does not match any player.
   */
  async recordSession(
    claimCode: string,
    gameId: string,
    completionTime: number,
    solvedAt?: Date,
  ): Promise<"created" | "exists"> {
    const player = await this.db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.claimCode, claimCode))
      .limit(1);

    const found = player[0];
    if (!found) {
      throw new PlayerNotFoundError(claimCode);
    }

    const result = await this.db
      .insert(gameSessions)
      .values({ playerId: found.id, gameId, completionTime, ...(solvedAt ? { solvedAt } : {}) })
      .onConflictDoNothing()
      .returning({ id: gameSessions.id });

    return result[0] ? "created" : "exists";
  }

  /**
   * Look up a completed session for a player+game combination.
   * Returns null if the player does not exist or has no session for the given game.
   * Uses a single join query — does not distinguish between missing player and missing session.
   */
  async getSession(claimCode: string, gameId: string): Promise<{ completionTime: number; solvedAt: Date } | null> {
    const result = await this.db
      .select({
        completionTime: gameSessions.completionTime,
        solvedAt: gameSessions.solvedAt,
      })
      .from(gameSessions)
      .innerJoin(players, eq(players.id, gameSessions.playerId))
      .where(and(eq(players.claimCode, claimCode), eq(gameSessions.gameId, gameId)))
      .limit(1);

    return result[0] ?? null;
  }

  /**
   * Get aggregated statistics for a player identified by their claim code.
   * Returns null if the claim code does not match any player.
   */
  async getStats(claimCode: string): Promise<PlayerStats | null> {
    // Single query: LEFT JOIN so we can distinguish "player not found" (0 rows)
    // from "player exists, no sessions" (1 row with null session columns).
    const rows = await this.db
      .select({
        gameId: gameSessions.gameId,
        completionTime: gameSessions.completionTime,
        solvedAt: gameSessions.solvedAt,
      })
      .from(players)
      .leftJoin(gameSessions, eq(gameSessions.playerId, players.id))
      .where(eq(players.claimCode, claimCode));

    if (rows.length === 0) {
      return null;
    }

    // Filter out the null-session row from a player with no games
    const allSessions = rows.filter((r): r is SessionRow => r.gameId !== null);

    const gamesPlayed = allSessions.length;
    const gamesSolved = gamesPlayed; // All recorded sessions are solves
    const winRate = gamesPlayed > 0 ? gamesSolved / gamesPlayed : 0;

    let bestTime: number | null = null;
    let averageTime: number | null = null;
    if (gamesPlayed > 0) {
      let sum = 0;
      let min = Infinity;
      for (const s of allSessions) {
        sum += s.completionTime;
        if (s.completionTime < min) {
          min = s.completionTime;
        }
      }
      bestTime = min;
      averageTime = Math.round(sum / gamesPlayed);
    }

    // Recent solves — derive puzzle date from game ID (not solvedAt, which may
    // reflect when the session was recorded rather than the puzzle's live date).
    const thirtyDaysAgo = DateTime.utc().minus({ days: 30 }).toISODate() ?? "";
    const recentSolves = allSessions
      .map((s) => {
        const puzzleDate = decodeGameId(s.gameId);
        const isoDate = puzzleDate?.toISODate();
        return isoDate ? { date: isoDate, completionTime: s.completionTime } : null;
      })
      .filter((s): s is { date: string; completionTime: number } => s !== null && s.date >= thirtyDaysAgo)
      .toSorted((a, b) => a.date.localeCompare(b.date));

    // Streak calculation from distinct solve dates
    const solveDateSet = new Set(allSessions.map((s) => DateTime.fromJSDate(s.solvedAt, { zone: "utc" }).toISODate()));
    const solveDates = [...solveDateSet].filter((d): d is string => d !== null).toSorted();
    const { currentStreak, bestStreak } = calculateStreaks(solveDates);

    return {
      gamesPlayed,
      gamesSolved,
      winRate,
      currentStreak,
      bestStreak,
      bestTime,
      averageTime,
      recentSolves,
    };
  }

  /**
   * Check database connectivity by executing a simple query.
   */
  async checkHealth(): Promise<{ status: "connected" | "error"; error?: string }> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return { status: "connected" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  }
}
