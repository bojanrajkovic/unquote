import type { FastifyPluginAsync } from "fastify";

import { ClaimCodeParamsSchema, RecordSessionRequestSchema, RecordSessionResponseSchema } from "./schemas.js";
import { DatabaseUnavailableError, PlayerNotFoundError } from "../types.js";
import { decodeGameId } from "../../game/game-id.js";

/**
 * Route plugin for POST /player/:code/session (session recording).
 */
export const sessionRoute: FastifyPluginAsync = async (fastify) => {
  fastify.route({
    method: "POST",
    url: "/:code/session",
    schema: {
      params: ClaimCodeParamsSchema,
      body: RecordSessionRequestSchema,
      response: {
        200: RecordSessionResponseSchema,
        201: RecordSessionResponseSchema,
      },
    },
    oas: {
      operationId: "recordSession",
      tags: ["player"],
      summary: "Record a game session",
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

      const { code } = request.params as { code: string };
      const { gameId, completionTime } = request.body as { gameId: string; completionTime: number };

      // Server-side validation: ensure gameId encodes a valid date
      const decoded = decodeGameId(gameId);
      if (decoded === null) {
        return reply.notFound("invalid or non-existent game ID");
      }

      try {
        const result = await playerStore.recordSession(code, gameId, completionTime);
        if (result === "created") {
          return reply.status(201).send({ status: "created" });
        } else {
          return reply.status(200).send({ status: "recorded" });
        }
      } catch (error) {
        if (error instanceof PlayerNotFoundError) {
          return reply.notFound(error.message);
        }
        if (error instanceof DatabaseUnavailableError) {
          return reply.serviceUnavailable(error.message);
        }
        throw error;
      }
    },
  });
};
