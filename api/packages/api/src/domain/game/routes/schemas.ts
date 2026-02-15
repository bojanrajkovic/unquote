import { Type, type Static } from "typebox";
import { schemaType } from "@eropple/fastify-openapi3";

/**
 * Schema for a single hint in the puzzle response.
 */
export const HintSchema = schemaType(
  "Hint",
  Type.Object(
    {
      cipherLetter: Type.String({ minLength: 1, maxLength: 1 }),
      plainLetter: Type.String({ minLength: 1, maxLength: 1 }),
    },
    { additionalProperties: false },
  ),
);

export type Hint = Static<typeof HintSchema>;

/**
 * Schema for the puzzle response returned by GET /game/today and GET /game/:date.
 */
export const PuzzleResponseSchema = schemaType(
  "PuzzleResponse",
  Type.Object(
    {
      id: Type.String({ description: "Opaque game ID for solution checking" }),
      date: Type.String({ format: "date", description: "ISO date (YYYY-MM-DD)" }),
      encryptedText: Type.String({ description: "Encrypted quote text" }),
      author: Type.String({ description: "Quote author" }),
      category: Type.String({ description: "Quote category (e.g. inspiration, humor)" }),
      difficulty: Type.Number({ minimum: 0, maximum: 100 }),
      hints: Type.Array(HintSchema),
    },
    { additionalProperties: false },
  ),
);

export type PuzzleResponse = Static<typeof PuzzleResponseSchema>;

/**
 * Schema for date path parameter.
 */
export const DateParamsSchema = schemaType(
  "DateParams",
  Type.Object(
    {
      date: Type.String({
        format: "date",
        description: "Date in ISO format (YYYY-MM-DD)",
      }),
    },
    { additionalProperties: false },
  ),
);

export type DateParams = Static<typeof DateParamsSchema>;

/**
 * Schema for game ID path parameter.
 */
export const GameIdParamsSchema = schemaType(
  "GameIdParams",
  Type.Object(
    {
      id: Type.String({ description: "Opaque game ID" }),
    },
    { additionalProperties: false },
  ),
);

export type GameIdParams = Static<typeof GameIdParamsSchema>;

/**
 * Schema for solution check request body.
 */
export const CheckRequestSchema = schemaType(
  "CheckRequest",
  Type.Object(
    {
      solution: Type.String({
        minLength: 1,
        maxLength: 5000,
        description: "User's decoded text",
      }),
    },
    { additionalProperties: false },
  ),
);

export type CheckRequest = Static<typeof CheckRequestSchema>;

/**
 * Schema for solution check response.
 */
export const CheckResponseSchema = schemaType(
  "CheckResponse",
  Type.Object(
    {
      correct: Type.Boolean(),
    },
    { additionalProperties: false },
  ),
);

export type CheckResponse = Static<typeof CheckResponseSchema>;
