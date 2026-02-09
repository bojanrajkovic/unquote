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
 * Health check route plugin.
 * - GET / - returns { status: "ok" }
 */
export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.route<{
    Reply: HealthResponse;
  }>({
    method: "GET",
    url: "/",
    logLevel: "warn",
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
