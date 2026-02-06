// eslint-disable-next-line import/consistent-type-specifier-style
import Fastify, { type FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { Logger } from "pino";
import fastifyEnv from "@fastify/env";
import cors from "@fastify/cors";
import fastifyOpenapi3, { oas3PluginAjv } from "@eropple/fastify-openapi3";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import underPressure from "@fastify/under-pressure";

import { EnvSchema } from "./config/index.js";
import { configureContainer, registerDependencyInjection } from "./deps/index.js";
import { registerGameRoutes } from "./domain/game/routes/index.js";
import { registerHealthRoutes } from "./domain/health/index.js";

// Import type extensions for side effects
import "./config/type-extensions.js";
import "./deps/type-extensions.js";

// eslint-disable-next-line max-lines-per-function
const buildServer = async (): Promise<FastifyInstance> => {
  // eslint-disable-next-line new-cap
  const fastify = Fastify({
    logger: {
      level: process.env["LOG_LEVEL"] ?? "info",
    },
    ajv: {
      plugins: [oas3PluginAjv],
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Register environment configuration first (validates and populates fastify.config)
  await fastify.register(fastifyEnv, {
    schema: EnvSchema,
    dotenv: process.env["NODE_ENV"] !== "production",
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  });

  await fastify.register(cors, {
    origin: true,
  });

  await fastify.register(underPressure, {
    maxEventLoopDelay: 1000,
    maxEventLoopUtilization: 0.98,
  });

  await fastify.register(sensible);

  // Configure and register DI container
  const container = configureContainer(fastify.config, fastify.log as Logger);
  await fastify.register(registerDependencyInjection, { container });

  await fastify.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute",
  });

  // Register OpenAPI plugin BEFORE routes so it can discover them
  await fastify.register(fastifyOpenapi3, {
    openapiInfo: {
      title: "Unquote API",
      version: "0.1.0",
    },
    publish: {
      ui: "scalar",
      scalarExtraOptions: {
        theme: "solarized",
        url: "/openapi.json",
      },
      json: true,
      yaml: true,
    },
  });

  // Register game routes with /game prefix
  await fastify.register(registerGameRoutes, { prefix: "/game" });

  // Register health routes at /health
  await fastify.register(registerHealthRoutes, { prefix: "/health" });

  return fastify;
};

// eslint-disable-next-line max-lines-per-function, max-depth
const start = async (): Promise<void> => {
  const server = await buildServer();

  // eslint-disable-next-line max-depth
  try {
    await server.listen({
      host: server.config.HOST,
      port: server.config.PORT,
    });
  } catch (error) {
    server.log.error(error);
    // eslint-disable-next-line no-process-exit, no-magic-numbers
    process.exit(1);
  }
};

// eslint-disable-next-line import/exports-last
export { buildServer };

await start();
