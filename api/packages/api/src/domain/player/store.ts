import { eq, and, sql, asc } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DateTime } from "luxon";
import { players, gameSessions } from "./schema.js";
import { generateClaimCode } from "./claim-code.js";
import type { PlayerStats } from "./types.js";
import { PlayerNotFoundError } from "./types.js";

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
  async recordSession(claimCode: string, gameId: string, completionTime: number): Promise<"created" | "exists"> {
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
      .values({ playerId: found.id, gameId, completionTime })
      .onConflictDoNothing()
      .returning({ id: gameSessions.id });

    return result[0] ? "created" : "exists";
  }

  /**
   * Get aggregated statistics for a player identified by their claim code.
   * Returns null if the claim code does not match any player.
   */
  async getStats(claimCode: string): Promise<PlayerStats | null> {
    const player = await this.db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.claimCode, claimCode))
      .limit(1);

    const found = player[0];
    if (!found) {
      return null;
    }

    const playerId = found.id;

    // Aggregate stats
    const [stats] = await this.db
      .select({
        gamesPlayed: sql<number>`cast(count(*) as int)`,
        bestTime: sql<number | null>`min(${gameSessions.completionTime})`,
        averageTime: sql<number | null>`avg(${gameSessions.completionTime})`,
      })
      .from(gameSessions)
      .where(eq(gameSessions.playerId, playerId));

    const gamesPlayed = stats?.gamesPlayed ?? 0;
    const gamesSolved = gamesPlayed; // All recorded sessions are solves
    const winRate = gamesPlayed > 0 ? gamesSolved / gamesPlayed : 0;
    const bestTime = stats?.bestTime ?? null;
    const averageTime =
      stats?.averageTime !== null && stats?.averageTime !== undefined ? Math.round(Number(stats.averageTime)) : null;

    // Recent solves (last 30 days)
    const recentSolves = await this.db
      .select({
        date: sql<string>`${gameSessions.solvedAt}::date::text`,
        completionTime: gameSessions.completionTime,
      })
      .from(gameSessions)
      .where(
        and(eq(gameSessions.playerId, playerId), sql`${gameSessions.solvedAt} >= CURRENT_DATE - INTERVAL '30 days'`),
      )
      .orderBy(asc(gameSessions.solvedAt));

    // Streak calculation from all distinct solve dates (group by date to deduplicate)
    const solveDates = await this.db
      .select({
        date: sql<string>`${gameSessions.solvedAt}::date::text`,
      })
      .from(gameSessions)
      .where(eq(gameSessions.playerId, playerId))
      .groupBy(sql`${gameSessions.solvedAt}::date`)
      .orderBy(asc(sql`${gameSessions.solvedAt}::date`));

    const { currentStreak, bestStreak } = calculateStreaks(solveDates.map((r) => r.date));

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
