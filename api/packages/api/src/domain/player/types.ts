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
