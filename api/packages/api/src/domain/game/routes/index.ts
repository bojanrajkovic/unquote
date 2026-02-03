import type { FastifyPluginAsync } from "fastify";

import { puzzleRoutes } from "./puzzle.js";
import { solutionRoutes } from "./solution.js";

/**
 * Aggregator plugin for game domain routes.
 * Registers puzzle retrieval and solution checking sub-routes.
 *
 * NOTE: This plugin is intentionally NOT wrapped with fastify-plugin
 * to preserve encapsulation and allow prefix registration to work correctly.
 */
export const registerGameRoutes: FastifyPluginAsync = async (fastify) => {
  // Register /today and /:date routes
  await fastify.register(puzzleRoutes);

  // Register /:id/check route
  await fastify.register(solutionRoutes);
};
