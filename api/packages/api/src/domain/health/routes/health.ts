import type { FastifyPluginAsync } from "fastify";
import { Type, type Static } from "typebox";
import { schemaType } from "@eropple/fastify-openapi3";

/**
 * Schema for health check response.
 */
export const HealthResponseSchema = schemaType(
  "HealthResponse",
  Type.Object({
    status: Type.Literal("ok"),
  }),
);

export type HealthResponse = Static<typeof HealthResponseSchema>;

/**
 * Health check route.
 * - GET / - returns { status: "ok" }
 */
const healthRoutesPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.route<{
    Reply: HealthResponse;
  }>({
    method: "GET",
    url: "/",
    schema: {
      response: {
        200: HealthResponseSchema,
      },
    },
    oas: {
      operationId: "healthCheck",
      tags: ["health"],
      summary: "Health check",
      description: "Returns the health status of the API server.",
    },
    handler: async () => {
      return { status: "ok" as const };
    },
  });
};

export const healthRoutes: FastifyPluginAsync = healthRoutesPlugin;
