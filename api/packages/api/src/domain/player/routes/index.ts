import type { FastifyPluginAsync } from "fastify";

import { registerRoute } from "./register.js";
import { sessionRoute } from "./session.js";
import { statsRoute } from "./stats.js";

/**
 * Aggregator plugin for player domain routes.
 * Registers player registration, session recording, and stats sub-routes.
 *
 * NOTE: This plugin is intentionally NOT wrapped with fastify-plugin
 * to preserve encapsulation and allow prefix registration to work correctly.
 */
export const registerPlayerRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(registerRoute);
  await fastify.register(sessionRoute);
  await fastify.register(statsRoute);
};
