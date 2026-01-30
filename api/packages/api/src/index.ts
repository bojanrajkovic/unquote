// eslint-disable-next-line import/consistent-type-specifier-style
import Fastify, { type FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import cors from "@fastify/cors";
import fastifyOpenapi3 from "@eropple/fastify-openapi3";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import underPressure from "@fastify/under-pressure";

// eslint-disable-next-line max-lines-per-function
const buildServer = async (): Promise<FastifyInstance> => {
  // eslint-disable-next-line new-cap
  const fastify = Fastify({
    logger: true,
  }).withTypeProvider<TypeBoxTypeProvider>();

  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  });

  await fastify.register(cors, {
    origin: true,
  });

  await fastify.register(underPressure, {
    maxEventLoopDelay: 1000,
    maxEventLoopUtilization: 0.98,
    maxHeapUsedBytes: 100_000_000,
    maxRssBytes: 100_000_000,
  });

  await fastify.register(sensible);

  await fastify.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute",
  });

  await fastify.register(fastifyOpenapi3, {
    openapiInfo: {
      title: "Unquote API",
      version: "0.1.0",
    },
  });

  return fastify;
};

// eslint-disable-next-line max-lines-per-function, max-depth
const start = async (): Promise<void> => {
  const server = await buildServer();

  // eslint-disable-next-line max-depth
  try {
    await server.listen({ host: "0.0.0.0", port: 3000 });
  } catch (error) {
    server.log.error(error);
    // eslint-disable-next-line no-process-exit, no-magic-numbers
    process.exit(1);
  }
};

// eslint-disable-next-line import/exports-last
export { buildServer };

await start();
