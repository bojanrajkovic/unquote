import type { FastifyPluginAsync } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

import { CreatePlayerResponseSchema } from "./schemas.js";
import { DatabaseUnavailableError } from "../types.js";

/**
 * Route plugin for POST /player (player registration).
 */
export const registerRoute: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

  server.post(
    "/",
    {
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
    },
    async (request, reply) => {
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
  );
};
