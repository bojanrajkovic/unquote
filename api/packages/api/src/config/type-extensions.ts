import type { AppConfig } from "./schema.js";

/**
 * Augment Fastify types to include typed config.
 */
declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
  }
}
