import type { FastifyPluginAsync } from "fastify";

import { ClaimCodeParamsSchema, PlayerStatsResponseSchema } from "./schemas.js";
import { DatabaseUnavailableError } from "../types.js";

/**
 * Route plugin for GET /player/:code/stats (player statistics retrieval).
 */
export const statsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.route({
    method: "GET",
    url: "/:code/stats",
    schema: {
      params: ClaimCodeParamsSchema,
      response: {
        200: PlayerStatsResponseSchema,
      },
    },
    oas: {
      operationId: "getPlayerStats",
      tags: ["player"],
      summary: "Get player statistics",
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

      try {
        const stats = await playerStore.getStats(code);

        if (stats === null) {
          return reply.notFound(`player not found: ${code}`);
        }

        return reply.send({ claimCode: code, ...stats });
      } catch (error) {
        if (error instanceof DatabaseUnavailableError) {
          return reply.serviceUnavailable(error.message);
        }
        throw error;
      }
    },
  });
};
