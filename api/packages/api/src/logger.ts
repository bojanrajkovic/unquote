// Type-only imports: instrumentation.ts imports this file before pino may load.
import type { FastifyInstance } from "fastify";
import type { LoggerOptions } from "pino";

const INFO = 30;

export const loggerOptions: LoggerOptions = {
  level: process.env["LOG_LEVEL"] ?? "info",
  base: { service: "unquote" },
  formatters: { level: (label) => ({ level: label }) },
  hooks: {
    // @eropple/fastify-openapi3 logs one info line per route at boot and has no level option.
    logMethod(args, method, level) {
      if (level === INFO && (args as unknown[])[1] === "Building operation for route.") {
        this.debug(...args);
        return;
      }
      method.apply(this, args);
    },
  },
};

/**
 * Log one line per completed request with top-level `http_method`, `url`, `http_status` and
 * `duration_ms`. Replaces Fastify's built-in request logging, which nests these under `req` and `res`.
 * A route's `logLevel` still applies, so routes set to `warn` stay quiet.
 */
export const logRequests = (fastify: FastifyInstance): void => {
  fastify.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        http_method: request.method,
        url: request.url,
        http_status: reply.statusCode,
        duration_ms: Math.round(reply.elapsedTime),
      },
      "request completed",
    );
  });
};
