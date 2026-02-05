import type { FastifyPluginAsync } from "fastify";
import { DateTime } from "luxon";

import type { GameGenerator, QuoteSource } from "@unquote/game-generator";

import { encodeGameId } from "../game-id.js";
import { PuzzleResponseSchema, DateParamsSchema, type PuzzleResponse, type DateParams } from "./schemas.js";

/**
 * Generate puzzle response from a DateTime.
 * Shared logic between /today and /:date routes.
 */
async function generatePuzzleResponse(
  date: DateTime,
  gameGenerator: GameGenerator,
  quoteSource: QuoteSource,
): Promise<PuzzleResponse> {
  const puzzle = await gameGenerator.generateDailyPuzzle(date);

  const quote = await quoteSource.getQuote(puzzle.quoteId);
  if (!quote) {
    throw new Error("quote not found for generated puzzle");
  }

  const gameId = encodeGameId(date);

  const dateStr = date.toISODate();
  if (!dateStr) {
    throw new Error("failed to format puzzle date");
  }

  return {
    id: gameId,
    date: dateStr,
    encryptedText: puzzle.encryptedText,
    author: quote.author,
    difficulty: quote.difficulty,
    hints: puzzle.hints.map((hint) => ({
      cipherLetter: hint.cipherLetter.toUpperCase(),
      plainLetter: hint.plainLetter.toUpperCase(),
    })),
  };
}

/**
 * Routes for puzzle retrieval.
 * - GET /today - today's puzzle
 * - GET /:date - puzzle for specific date
 *
 * IMPORTANT: /today must be registered BEFORE /:date to prevent
 * "today" from being captured as a date parameter.
 */
const puzzleRoutesPlugin: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /today
   * Returns today's cryptoquip puzzle.
   */
  fastify.route<{
    Reply: PuzzleResponse;
  }>({
    method: "GET",
    url: "/today",
    schema: {
      response: {
        200: PuzzleResponseSchema,
      },
    },
    oas: {
      operationId: "getTodayPuzzle",
      tags: ["game"],
      summary: "Get today's puzzle",
      description: "Retrieves the cryptoquip puzzle for the current date (UTC)",
    },
    handler: async (request) => {
      const today = DateTime.utc().startOf("day");

      const deps = request.deps;
      if (!deps) {
        throw fastify.httpErrors.internalServerError("dependency injection not initialized");
      }

      const { gameGenerator, quoteSource } = deps;

      try {
        return await generatePuzzleResponse(today, gameGenerator, quoteSource);
      } catch (error) {
        if (error instanceof Error && error.message === "quote not found for generated puzzle") {
          throw fastify.httpErrors.internalServerError(error.message);
        }
        throw error;
      }
    },
  });

  /**
   * GET /:date
   * Returns the cryptoquip puzzle for a specific date.
   */
  fastify.route<{
    Params: DateParams;
    Reply: PuzzleResponse;
  }>({
    method: "GET",
    url: "/:date",
    schema: {
      params: DateParamsSchema,
      response: {
        200: PuzzleResponseSchema,
      },
    },
    oas: {
      operationId: "getPuzzleByDate",
      tags: ["game"],
      summary: "Get puzzle for a specific date",
      description: "Retrieves the cryptoquip puzzle for the specified date (ISO format: YYYY-MM-DD)",
    },
    handler: async (request) => {
      const { date: dateStr } = request.params;

      const deps = request.deps;
      if (!deps) {
        throw fastify.httpErrors.internalServerError("dependency injection not initialized");
      }

      const { gameGenerator, quoteSource } = deps;

      // Parse and validate date
      const date = DateTime.fromISO(dateStr, { zone: "utc" });

      if (!date.isValid) {
        throw fastify.httpErrors.badRequest(`invalid date format: expected YYYY-MM-DD, got '${dateStr}'`);
      }

      try {
        return await generatePuzzleResponse(date, gameGenerator, quoteSource);
      } catch (error) {
        if (error instanceof Error && error.message === "quote not found for generated puzzle") {
          throw fastify.httpErrors.internalServerError(error.message);
        }
        throw error;
      }
    },
  });
};

/**
 * Register puzzle routes.
 */
export const puzzleRoutes: FastifyPluginAsync = puzzleRoutesPlugin;
