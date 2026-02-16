import { pgTable, uuid, text, integer, timestamp, unique, index } from "drizzle-orm/pg-core";
import type { PlayerId, GameSessionId } from "./types.js";

export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom().$type<PlayerId>(),
  claimCode: text("claim_code").unique().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gameSessions = pgTable(
  "game_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom().$type<GameSessionId>(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id)
      .$type<PlayerId>(),
    gameId: text("game_id").notNull(),
    completionTime: integer("completion_time").notNull(),
    solvedAt: timestamp("solved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("game_sessions_player_game_unique").on(table.playerId, table.gameId),
    index("game_sessions_solved_at_idx").on(table.solvedAt),
  ],
);
