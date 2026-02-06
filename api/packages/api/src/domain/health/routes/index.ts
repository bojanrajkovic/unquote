import type { FastifyPluginAsync } from "fastify";

import { healthRoutes } from "./health.js";

/**
 * Aggregator plugin for health domain routes.
 *
 * NOTE: This plugin is intentionally NOT wrapped with fastify-plugin
 * to preserve encapsulation and allow prefix registration to work correctly.
 */
export const registerHealthRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(healthRoutes);
};
