import type { FastifyPluginAsync } from "fastify";

import {
  GameSessionParamsSchema,
  GameSessionResponseSchema,
  type GameSessionParams,
  type GameSessionResponse,
} from "./schemas.js";
import { DatabaseUnavailableError } from "../types.js";
import { decodeGameId } from "../../game/game-id.js";

/**
 * Route plugin for GET /player/:code/session/:gameId (session lookup).
 */
export const sessionLookupRoute: FastifyPluginAsync = async (fastify) => {
  fastify.route<{
    Params: GameSessionParams;
    Reply: GameSessionResponse;
  }>({
    method: "GET",
    url: "/:code/session/:gameId",
    schema: {
      params: GameSessionParamsSchema,
      response: {
        200: GameSessionResponseSchema,
      },
    },
    oas: {
      operationId: "getPlayerSession",
      tags: ["player"],
      summary: "Look up a player session for a specific game",
    },
    handler: async (request, reply) => {
      const deps = request.deps;
      if (!deps) {
        throw fastify.httpErrors.internalServerError("dependency injection not initialized");
      }

      const { playerStore } = deps;

      if (playerStore === null) {
        return reply.serviceUnavailable("database is not configured");
      }

      const { code, gameId } = request.params;

      const decoded = decodeGameId(gameId);
      if (decoded === null) {
        return reply.notFound("invalid or non-existent game ID");
      }

      try {
        const session = await playerStore.getSession(code, gameId);

        if (session === null) {
          return reply.notFound("no session found");
        }

        return reply.send({
          completionTime: session.completionTime,
          solvedAt: session.solvedAt.toISOString(),
        });
      } catch (error) {
        if (error instanceof DatabaseUnavailableError) {
          return reply.serviceUnavailable(error.message);
        }
        throw error;
      }
    },
  });
};
