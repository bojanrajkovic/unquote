import type { FastifyPluginAsync } from "fastify";
import { validateSolution } from "@unquote/game-generator";

import { decodeGameId } from "../game-id.js";
import {
  GameIdParamsSchema,
  CheckRequestSchema,
  CheckResponseSchema,
  type GameIdParams,
  type CheckRequest,
  type CheckResponse,
} from "./schemas.js";

/**
 * Routes for solution validation.
 * - POST /:id/check - validate solution attempt
 */
const solutionRoutesPlugin: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /:id/check
   * Validates a solution attempt for a puzzle.
   *
   * Returns 200 with { correct: true/false } for valid attempts.
   * Returns 404 if the game ID is invalid or cannot be decoded.
   */
  fastify.route<{
    Params: GameIdParams;
    Body: CheckRequest;
    Reply: CheckResponse;
  }>({
    method: "POST",
    url: "/:id/check",
    schema: {
      params: GameIdParamsSchema,
      body: CheckRequestSchema,
      response: {
        200: CheckResponseSchema,
      },
    },
    oas: {
      operationId: "checkSolution",
      tags: ["game"],
      summary: "Check solution attempt",
      description:
        "Validates a user's solution attempt for the specified game. Returns whether the solution is correct.",
    },
    handler: async (request) => {
      const { id } = request.params;
      const { solution } = request.body;

      const deps = request.deps;
      if (!deps) {
        throw fastify.httpErrors.internalServerError(
          "dependency injection not initialized",
        );
      }

      const { gameGenerator, quoteSource } = deps;

      // Decode game ID to get the date
      const dateTime = decodeGameId(id);
      if (!dateTime) {
        throw fastify.httpErrors.notFound("invalid game id");
      }

      // Regenerate the puzzle to get the quote ID
      const puzzle = await gameGenerator.generateDailyPuzzle(dateTime);

      // Get the original quote
      const quote = await quoteSource.getQuote(puzzle.quoteId);
      if (!quote) {
        throw fastify.httpErrors.internalServerError(
          "quote not found for puzzle",
        );
      }

      // Validate the solution
      const correct = validateSolution(solution, quote.text);

      return { correct };
    },
  });
};

/**
 * Register solution routes.
 */
export const solutionRoutes: FastifyPluginAsync = solutionRoutesPlugin;
