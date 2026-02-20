import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { DateTime } from "luxon";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createMigratedSnapshot, restoreSnapshot, type PGliteSnapshot } from "../../../tests/helpers/pglite.js";
import { PgPlayerStore } from "./store.js";
import { PlayerNotFoundError } from "./types.js";
import { players, gameSessions } from "./schema.js";

let snapshot: PGliteSnapshot;
let client: PGlite;
let db: ReturnType<typeof drizzle>;
let store: PgPlayerStore;

beforeAll(async () => {
  snapshot = await createMigratedSnapshot();
});

beforeEach(async () => {
  client = await restoreSnapshot(snapshot);
  db = drizzle({ client });
  store = new PgPlayerStore(db as unknown as NodePgDatabase);
});

afterEach(async () => {
  await client.close();
});

describe("createPlayer", () => {
  it("AC2.1: returns a claim code in ADJECTIVE-NOUN-NNNN format", async () => {
    const result = await store.createPlayer();
    expect(result.claimCode).toMatch(/^[A-Z]+-[A-Z]+-\d{4}$/);
  });

  it("AC2.2: two calls return different claim codes", async () => {
    const result1 = await store.createPlayer();
    const result2 = await store.createPlayer();
    expect(result1.claimCode).not.toBe(result2.claimCode);
  });

  it("AC2.3: creating many players all succeed with unique codes", async () => {
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const result = await store.createPlayer();
      codes.add(result.claimCode);
    }
    expect(codes.size).toBe(20);
  });
});

describe("recordSession", () => {
  it("AC3.1: returns 'created' for a new session", async () => {
    const { claimCode } = await store.createPlayer();
    const result = await store.recordSession(claimCode, "game-2026-02-15", 120);
    expect(result).toBe("created");
  });

  it("AC3.2: returns 'exists' when recording the same session again", async () => {
    const { claimCode } = await store.createPlayer();
    await store.recordSession(claimCode, "game-2026-02-15", 120);
    const result = await store.recordSession(claimCode, "game-2026-02-15", 120);
    expect(result).toBe("exists");
  });

  it("AC3.3: throws PlayerNotFoundError for unknown claim code", async () => {
    await expect(store.recordSession("UNKNOWN-CODE-0000", "game-2026-02-15", 120)).rejects.toThrow(PlayerNotFoundError);
  });
});

describe("getStats", () => {
  it("AC4.3: returns zeroed counts and null for bestTime/averageTime with no sessions", async () => {
    const { claimCode } = await store.createPlayer();
    const stats = await store.getStats(claimCode);
    expect(stats).toEqual({
      gamesPlayed: 0,
      gamesSolved: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      bestTime: null,
      averageTime: null,
      recentSolves: [],
    });
  });

  it("AC4.4: returns null for unknown claim code", async () => {
    const stats = await store.getStats("UNKNOWN-CODE-0000");
    expect(stats).toBeNull();
  });

  it("AC4.1: returns correct aggregated values after recording sessions", async () => {
    const { claimCode } = await store.createPlayer();
    await store.recordSession(claimCode, "game-2026-02-13", 90);
    await store.recordSession(claimCode, "game-2026-02-14", 150);
    await store.recordSession(claimCode, "game-2026-02-15", 60);

    const stats = await store.getStats(claimCode);
    expect(stats).not.toBeNull();
    expect(stats?.gamesPlayed).toBe(3);
    expect(stats?.gamesSolved).toBe(3);
    expect(stats?.winRate).toBe(1);
    expect(stats?.bestTime).toBe(60);
    expect(stats?.averageTime).toBe(100); // (90 + 150 + 60) / 3 = 100
  });

  it("AC4.2: recentSolves contains only last 30 days ordered by date ascending", async () => {
    await store.createPlayer();

    // Look up the player's id to insert directly
    const [playerRow] = await db.select({ id: players.id }).from(players);
    const playerId = playerRow?.id;
    if (!playerId) {
      throw new Error("expected player row");
    }

    // Insert a session older than 30 days
    await db.insert(gameSessions).values({
      playerId,
      gameId: "game-old",
      completionTime: 200,
      solvedAt: new Date("2020-01-01T12:00:00Z"),
    });

    // Insert recent sessions
    await db.insert(gameSessions).values({
      playerId,
      gameId: "game-recent-1",
      completionTime: 120,
      solvedAt: new Date("2026-02-14T12:00:00Z"),
    });
    await db.insert(gameSessions).values({
      playerId,
      gameId: "game-recent-2",
      completionTime: 90,
      solvedAt: new Date("2026-02-15T12:00:00Z"),
    });

    // Look up claim code from inserted player
    const [player] = await db.select({ claimCode: players.claimCode }).from(players);
    if (!player) {
      throw new Error("expected player");
    }
    const stats = await store.getStats(player.claimCode);
    expect(stats).not.toBeNull();

    // Old session should not appear in recentSolves
    expect(stats?.recentSolves).toHaveLength(2);
    // Ordered by date ascending
    expect(stats?.recentSolves[0]?.completionTime).toBe(120);
    expect(stats?.recentSolves[1]?.completionTime).toBe(90);
  });
});

describe("checkHealth", () => {
  it("AC5.1: returns { status: 'connected' } with a working connection", async () => {
    const result = await store.checkHealth();
    expect(result).toEqual({ status: "connected" });
  });

  it("AC5.2: returns { status: 'error', error: ... } when connection fails", async () => {
    // Close the client to simulate a failed connection
    await client.close();

    const result = await store.checkHealth();
    expect(result.status).toBe("error");
    expect(typeof result.error).toBe("string");
    expect(result.error?.length ?? 0).toBeGreaterThan(0);

    // Replace the close method with a no-op so afterEach doesn't double-close
    client.close = async (): Promise<void> => {};
  });
});

describe("streak calculation", () => {
  async function setupPlayerWithSessions(sessionDates: Date[]): Promise<{ claimCode: string }> {
    const { claimCode } = await store.createPlayer();
    const [playerRow] = await db.select({ id: players.id }).from(players);
    const playerId = playerRow?.id;
    if (!playerId) {
      throw new Error("expected player row");
    }

    for (let i = 0; i < sessionDates.length; i++) {
      await db.insert(gameSessions).values({
        playerId,
        gameId: `game-streak-${i}`,
        completionTime: 120,
        solvedAt: sessionDates[i],
      });
    }

    return { claimCode };
  }

  it("AC6.1: current streak increments for consecutive calendar days with a solve", async () => {
    const utcNow = DateTime.utc();
    const today = utcNow.toJSDate();
    const yesterday = utcNow.minus({ days: 1 }).toJSDate();
    const dayBefore = utcNow.minus({ days: 2 }).toJSDate();

    const { claimCode } = await setupPlayerWithSessions([dayBefore, yesterday, today]);

    const stats = await store.getStats(claimCode);
    expect(stats).not.toBeNull();
    expect(stats?.currentStreak).toBe(3);
  });

  it("AC6.2: best streak reflects the longest consecutive run in history", async () => {
    const utcNow = DateTime.utc();
    // A 5-day run well in the past (far enough back to leave a clear gap)
    const pastBase = utcNow.minus({ days: 30 });
    const pastRun = [0, 1, 2, 3, 4].map((d) => pastBase.plus({ days: d }).toJSDate());
    // A 2-day run ending today
    const recentRun = [utcNow.minus({ days: 1 }).toJSDate(), utcNow.toJSDate()];

    const { claimCode } = await setupPlayerWithSessions([...pastRun, ...recentRun]);

    const stats = await store.getStats(claimCode);
    expect(stats).not.toBeNull();
    expect(stats?.bestStreak).toBe(5);
    expect(stats?.currentStreak).toBe(2);
  });

  it("AC6.3: streak resets to 0 when a day is missed", async () => {
    const utcNow = DateTime.utc();
    // Last solve was 5+ days ago with a clear gap to today
    const { claimCode } = await setupPlayerWithSessions([
      utcNow.minus({ days: 7 }).toJSDate(),
      utcNow.minus({ days: 6 }).toJSDate(),
      // gap — no solve from day-5 through today
    ]);

    const stats = await store.getStats(claimCode);
    expect(stats).not.toBeNull();
    expect(stats?.currentStreak).toBe(0);
  });

  it("AC6.4: multiple solves on the same day count as 1 streak day", async () => {
    const { claimCode } = await store.createPlayer();
    const [playerRow] = await db.select({ id: players.id }).from(players);
    const playerId = playerRow?.id;
    if (!playerId) {
      throw new Error("expected player row");
    }

    const utcNow = DateTime.utc();
    // Insert two sessions on the same day (today, different times)
    await db.insert(gameSessions).values({
      playerId,
      gameId: "game-same-day-1",
      completionTime: 100,
      solvedAt: utcNow.startOf("day").plus({ hours: 9 }).toJSDate(),
    });
    await db.insert(gameSessions).values({
      playerId,
      gameId: "game-same-day-2",
      completionTime: 110,
      solvedAt: utcNow.startOf("day").plus({ hours: 15 }).toJSDate(),
    });

    const stats = await store.getStats(claimCode);
    expect(stats).not.toBeNull();
    // Two sessions on same day still count as streak of 1
    expect(stats?.currentStreak).toBe(1);
    expect(stats?.bestStreak).toBe(1);
  });
});
