import { Type, type Static } from "typebox";
import { schemaType } from "@eropple/fastify-openapi3";

/**
 * Path parameter schema for endpoints that accept a player claim code.
 */
export const ClaimCodeParamsSchema = schemaType(
  "ClaimCodeParams",
  Type.Object(
    {
      code: Type.String({ description: "Player claim code in ADJECTIVE-NOUN-NNNN format" }),
    },
    { additionalProperties: false },
  ),
);

export type ClaimCodeParams = Static<typeof ClaimCodeParamsSchema>;

/**
 * Response schema for POST /player (player registration).
 */
export const CreatePlayerResponseSchema = schemaType(
  "CreatePlayerResponse",
  Type.Object(
    {
      claimCode: Type.String({ description: "Human-readable claim code" }),
    },
    { additionalProperties: false },
  ),
);

export type CreatePlayerResponse = Static<typeof CreatePlayerResponseSchema>;

/**
 * Request body schema for POST /player/:code/session.
 */
export const RecordSessionRequestSchema = schemaType(
  "RecordSessionRequest",
  Type.Object(
    {
      gameId: Type.String({ description: "Opaque game ID from puzzle response" }),
      completionTime: Type.Number({ description: "Solve time in milliseconds" }),
      solvedAt: Type.Optional(
        Type.String({
          format: "date-time",
          description: "ISO 8601 timestamp when the puzzle was solved; defaults to server time if omitted",
        }),
      ),
    },
    { additionalProperties: false },
  ),
);

export type RecordSessionRequest = Static<typeof RecordSessionRequestSchema>;

/**
 * Response schema for POST /player/:code/session.
 */
export const RecordSessionResponseSchema = schemaType(
  "RecordSessionResponse",
  Type.Object(
    {
      status: Type.Union([Type.Literal("created"), Type.Literal("recorded")]),
    },
    { additionalProperties: false },
  ),
);

export type RecordSessionResponse = Static<typeof RecordSessionResponseSchema>;

/**
 * Response schema for GET /player/:code/stats.
 */
export const PlayerStatsResponseSchema = schemaType(
  "PlayerStatsResponse",
  Type.Object(
    {
      claimCode: Type.String(),
      gamesPlayed: Type.Integer(),
      gamesSolved: Type.Integer(),
      winRate: Type.Number({ description: "Solved / played ratio, 0-1" }),
      currentStreak: Type.Integer({ description: "Consecutive days with a solve" }),
      bestStreak: Type.Integer(),
      bestTime: Type.Union([Type.Number(), Type.Null()], {
        description: "Best completion time in milliseconds, null if no solves",
      }),
      averageTime: Type.Union([Type.Number(), Type.Null()], {
        description: "Average completion time in milliseconds, null if no solves",
      }),
      recentSolves: Type.Array(
        Type.Object({
          date: Type.String({ format: "date" }),
          completionTime: Type.Number({ description: "Milliseconds" }),
        }),
        { description: "Last 30 days of solves, ordered by date ascending" },
      ),
    },
    { additionalProperties: false },
  ),
);

export type PlayerStatsResponse = Static<typeof PlayerStatsResponseSchema>;
