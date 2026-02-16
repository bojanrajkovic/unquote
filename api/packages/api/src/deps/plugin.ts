import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import type { AwilixContainer } from "awilix";
import type { Logger } from "pino";
import type { AppSingletonCradle } from "./singleton.js";
import { configureRequestScope } from "./request.js";

export type DependencyInjectionPluginOptions = {
  container: AwilixContainer<AppSingletonCradle>;
  shutdown?: () => Promise<void>;
};

/**
 * Fastify plugin that integrates Awilix DI container.
 * - Attaches singleton container to fastify.diContainer
 * - Creates request-scoped containers in onRequest hook
 * - Disposes request scopes in onResponse hook
 * - Closes database pool on server close
 */
const dependencyInjectionPlugin: FastifyPluginAsync<DependencyInjectionPluginOptions> = async (fastify, options) => {
  const { container, shutdown = async (): Promise<void> => {} } = options;

  // Attach singleton container and deps getter to Fastify instance
  fastify.decorate("diContainer", container);
  fastify.decorate("deps", {
    getter() {
      return this.diContainer.cradle;
    },
  });

  // Decorate request with diScope placeholder and deps getter
  fastify.decorateRequest("diScope", undefined);
  fastify.decorateRequest("deps", {
    getter() {
      return this.diScope?.cradle;
    },
  });

  // Create request scope on each request
  fastify.addHook("onRequest", async (request) => {
    // request.log is a child logger with request context (trace_id from OTel)
    const requestScope = configureRequestScope(container, request.log as Logger);
    request.diScope = requestScope;
  });

  // Dispose request scope after response is sent
  fastify.addHook("onResponse", async (request) => {
    if (request.diScope) {
      await request.diScope.dispose();
    }
  });

  // Graceful database pool shutdown
  fastify.addHook("onClose", shutdown);
};

/**
 * Register DI plugin with Fastify instance.
 */
export const registerDependencyInjection = fp(dependencyInjectionPlugin, {
  name: "dependency-injection",
  fastify: "5.x",
});
