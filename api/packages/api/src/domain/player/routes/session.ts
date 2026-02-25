import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import {
  ClaimCodeParamsSchema,
  GameSessionParamsSchema,
  RecordSessionRequestSchema,
  RecordSessionResponseSchema,
  RecordSessionPathRequestSchema,
  type ClaimCodeParams,
  type GameSessionParams,
  type RecordSessionRequest,
  type RecordSessionPathRequest,
  type RecordSessionResponse,
} from "./schemas.js";
import { DatabaseUnavailableError, PlayerNotFoundError } from "../types.js";
import { decodeGameId } from "../../game/game-id.js";

/**
 * Route plugin for POST /player/:code/session and POST /player/:code/session/:gameId.
 *
 * The game ID can be provided in the URL path or in the request body.
 * Each route's schema guarantees the game ID is present from its respective source.
 */
export const sessionRoute: FastifyPluginAsync = async (fastify) => {
  const rateLimitConfig = {
    max: 10,
    timeWindow: "1 minute",
  };

  const responseSchema = {
    200: RecordSessionResponseSchema,
    201: RecordSessionResponseSchema,
  };

  async function handleRecordSession(
    request: FastifyRequest,
    reply: FastifyReply,
    code: string,
    gameId: string,
    completionTime: number,
    solvedAt?: string,
  ): Promise<RecordSessionResponse> {
    const deps = request.deps;
    if (!deps) {
      throw fastify.httpErrors.internalServerError("dependency injection not initialized");
    }

    const { playerStore } = deps;

    if (playerStore === null) {
      return reply.serviceUnavailable("database is not configured");
    }

    // Server-side validation: ensure gameId encodes a valid date
    const decoded = decodeGameId(gameId);
    if (decoded === null) {
      return reply.notFound("invalid or non-existent game ID");
    }

    try {
      const result = await playerStore.recordSession(
        code,
        gameId,
        completionTime,
        solvedAt ? new Date(solvedAt) : undefined,
      );
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
  }

  // POST /:code/session — gameId required in the request body
  fastify.route<{
    Params: ClaimCodeParams;
    Body: RecordSessionRequest;
    Reply: RecordSessionResponse;
  }>({
    method: "POST",
    url: "/:code/session",
    config: {
      rateLimit: rateLimitConfig,
    },
    schema: {
      params: ClaimCodeParamsSchema,
      body: RecordSessionRequestSchema,
      response: responseSchema,
    },
    oas: {
      operationId: "recordSession",
      tags: ["player"],
      summary: "Record a game session",
    },
    handler: async (request, reply) => {
      const { code } = request.params;
      const { gameId, completionTime, solvedAt } = request.body;
      return handleRecordSession(request, reply, code, gameId, completionTime, solvedAt);
    },
  });

  // POST /:code/session/:gameId — gameId required in the URL path
  fastify.route<{
    Params: GameSessionParams;
    Body: RecordSessionPathRequest;
    Reply: RecordSessionResponse;
  }>({
    method: "POST",
    url: "/:code/session/:gameId",
    config: {
      rateLimit: rateLimitConfig,
    },
    schema: {
      params: GameSessionParamsSchema,
      body: RecordSessionPathRequestSchema,
      response: responseSchema,
    },
    oas: {
      operationId: "recordSessionByPath",
      tags: ["player"],
      summary: "Record a game session (game ID in URL)",
    },
    handler: async (request, reply) => {
      const { code, gameId } = request.params;
      const { completionTime, solvedAt } = request.body;
      return handleRecordSession(request, reply, code, gameId, completionTime, solvedAt);
    },
  });
};
