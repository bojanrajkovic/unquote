import type { AwilixContainer } from "awilix";
import type { AppSingletonCradle, AppRequestCradle } from "./index.js";

/**
 * Augment Fastify types to include DI container access.
 */
declare module "fastify" {
  interface FastifyInstance {
    /**
     * Singleton Awilix container.
     * Use createScope() to create request-scoped containers.
     */
    readonly diContainer: AwilixContainer<AppSingletonCradle>;

    /**
     * Convenience accessor for singleton dependencies.
     * Equivalent to fastify.diContainer.cradle
     */
    readonly deps: AppSingletonCradle;
  }

  interface FastifyRequest {
    /**
     * Request-scoped Awilix container.
     * Created in onRequest hook, disposed in onResponse hook.
     */
    diScope?: AwilixContainer<AppRequestCradle>;

    /**
     * Convenience accessor for request-scoped dependencies.
     * Equivalent to request.diScope.cradle
     */
    deps?: AppRequestCradle;
  }
}
