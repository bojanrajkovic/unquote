import { asValue, type AwilixContainer } from "awilix";
import type { Logger } from "pino";
import type { AppSingletonCradle } from "./singleton.js";

/**
 * Request-scoped cradle. Same shape as singleton but with request-specific
 * logger instance that carries OpenTelemetry trace context.
 */
export type AppRequestCradle = AppSingletonCradle;

/**
 * Configure a request-scoped container from the singleton parent.
 * Overrides the logger with a child logger that includes request context.
 *
 * @param parent - Singleton container
 * @param requestLogger - Pino child logger with trace context from request
 * @returns Scoped container for this request
 */
export function configureRequestScope(
  parent: AwilixContainer<AppSingletonCradle>,
  requestLogger: Logger,
): AwilixContainer<AppRequestCradle> {
  const scope = parent.createScope<AppRequestCradle>();

  // Override logger with request-scoped logger (has trace_id, span_id from OTel)
  scope.register({
    logger: asValue(requestLogger),
  });

  return scope;
}
