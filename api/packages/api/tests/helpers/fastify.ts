import Fastify, { type FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { oas3PluginAjv } from "@eropple/fastify-openapi3";
import sensible from "@fastify/sensible";
import type { AwilixContainer } from "awilix";

import { registerDependencyInjection } from "../../src/deps/index.js";
import type { AppSingletonCradle } from "../../src/deps/index.js";

/**
 * Create a Fastify instance wired up with test dependencies.
 * Registers sensible, dependency injection, and the given route plugin.
 * Returns a ready Fastify instance; caller is responsible for calling close().
 */
export async function createTestFastify(
  container: AwilixContainer<AppSingletonCradle>,
  routePlugin: Parameters<FastifyInstance["register"]>[0],
): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: false,
    ajv: {
      plugins: [oas3PluginAjv],
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  await fastify.register(sensible);
  await fastify.register(registerDependencyInjection, { container });
  await fastify.register(routePlugin);
  await fastify.ready();

  return fastify;
}
