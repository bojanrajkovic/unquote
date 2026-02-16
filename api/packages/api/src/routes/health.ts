import type { FastifyPluginAsync } from "fastify";
import { Type, type Static } from "typebox";
import { schemaType } from "@eropple/fastify-openapi3";
import type { PlayerStore } from "../domain/player/types.js";

const HealthLiveResponseSchema = schemaType(
  "HealthLiveResponse",
  Type.Object(
    {
      status: Type.Literal("ok"),
    },
    { additionalProperties: false },
  ),
);

type HealthLiveResponse = Static<typeof HealthLiveResponseSchema>;

const HealthReadyResponseSchema = schemaType(
  "HealthReadyResponse",
  Type.Object(
    {
      status: Type.Literal("ok"),
      database: Type.Union([Type.Literal("connected"), Type.Literal("error"), Type.Literal("unconfigured")]),
      databaseError: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  ),
);

type HealthReadyResponse = Static<typeof HealthReadyResponseSchema>;

/**
 * Health check route plugin.
 * - GET /live - liveness probe, always returns { status: "ok" }
 * - GET /ready - readiness probe, reports database connectivity
 */
export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.route<{
    Reply: HealthLiveResponse;
  }>({
    method: "GET",
    url: "/live",
    logLevel: "warn",
    schema: {
      response: {
        200: HealthLiveResponseSchema,
      },
    },
    oas: {
      operationId: "healthLive",
      tags: ["health"],
      summary: "Liveness probe",
    },
    handler: async () => {
      return { status: "ok" as const };
    },
  });

  fastify.route<{
    Reply: HealthReadyResponse;
  }>({
    method: "GET",
    url: "/ready",
    logLevel: "warn",
    schema: {
      response: {
        200: HealthReadyResponseSchema,
      },
    },
    oas: {
      operationId: "healthReady",
      tags: ["health"],
      summary: "Readiness probe",
    },
    handler: async () => {
      const playerStore: PlayerStore | null = fastify.deps.playerStore;

      if (playerStore === null) {
        return { status: "ok" as const, database: "unconfigured" as const };
      }

      const result = await playerStore.checkHealth();

      if (result.status === "connected") {
        return { status: "ok" as const, database: "connected" as const };
      }

      const response: HealthReadyResponse = {
        status: "ok",
        database: "error",
      };
      if (result.error !== undefined) {
        response.databaseError = result.error;
      }
      return response;
    },
  });
};
