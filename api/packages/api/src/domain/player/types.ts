import { randomUUID } from "node:crypto";
import type { Tagged } from "type-fest";
import { Type, type Static } from "typebox";

/**
 * Branded UUID string type. Base type for all domain-specific IDs.
 */
export type StringUUIDType = ReturnType<typeof randomUUID>;

export const StringUUID = Type.Unsafe<StringUUIDType>({
  ...Type.String({
    format: "uuid",
    pattern: "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
  }),
});

export type StringUUID = Static<typeof StringUUID>;

/**
 * Branded player identifier. Cannot be used interchangeably with GameSessionId.
 */
export type PlayerId = Tagged<StringUUID, "playerId">;

export const PlayerIdSchema = Type.Unsafe<PlayerId>({ ...StringUUID });

/**
 * Branded game session identifier. Cannot be used interchangeably with PlayerId.
 */
export type GameSessionId = Tagged<StringUUID, "gameSessionId">;

export const GameSessionIdSchema = Type.Unsafe<GameSessionId>({ ...StringUUID });

/**
 * Aggregated player statistics.
 */
export type PlayerStats = {
  gamesPlayed: number;
  gamesSolved: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  /** Best completion time in milliseconds, null if no solves. */
  bestTime: number | null;
  /** Average completion time in milliseconds, null if no solves. */
  averageTime: number | null;
  recentSolves: { date: string; /** Completion time in milliseconds. */ completionTime: number }[];
};

/**
 * PlayerStore interface — data access layer for player operations.
 * All methods throw DatabaseUnavailableError when database is not configured.
 */
export type PlayerStore = {
  createPlayer(): Promise<{ claimCode: string }>;
  /** Record a game session. @param completionTime - Solve time in milliseconds. */
  recordSession(claimCode: string, gameId: string, completionTime: number): Promise<"created" | "exists">;
  getStats(claimCode: string): Promise<PlayerStats | null>;
  checkHealth(): Promise<{ status: "connected" | "error"; error?: string }>;
};

/**
 * Thrown when a PlayerStore operation is attempted but no database is configured.
 * The API layer catches this and returns 503 Service Unavailable.
 */
export class DatabaseUnavailableError extends Error {
  constructor() {
    super("database is not configured");
    this.name = "DatabaseUnavailableError";
  }
}

/**
 * Thrown when a claim code does not match any player.
 * The API layer catches this and returns 404 Not Found.
 */
export class PlayerNotFoundError extends Error {
  constructor(claimCode: string) {
    super(`player not found: ${claimCode}`);
    this.name = "PlayerNotFoundError";
  }
}
