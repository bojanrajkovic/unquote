import type { FastifyPluginAsync } from "fastify";

import { CreatePlayerResponseSchema, type CreatePlayerResponse } from "./schemas.js";
import { DatabaseUnavailableError } from "../types.js";

/**
 * Route plugin for POST /player (player registration).
 */
export const registerRoute: FastifyPluginAsync = async (fastify) => {
  fastify.route<{
    Reply: CreatePlayerResponse;
  }>({
    method: "POST",
    url: "/",
    schema: {
      response: {
        201: CreatePlayerResponseSchema,
      },
    },
    oas: {
      operationId: "createPlayer",
      tags: ["player"],
      summary: "Register a new player",
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

      try {
        const result = await playerStore.createPlayer();
        return reply.status(201).send(result);
      } catch (error) {
        if (error instanceof DatabaseUnavailableError) {
          return reply.serviceUnavailable(error.message);
        }
        throw error;
      }
    },
  });
};
