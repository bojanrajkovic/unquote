import { trace, SpanStatusCode } from "@opentelemetry/api";
import type { Span } from "@opentelemetry/api";

/**
 * Creates a Proxy wrapper around a target object that instruments method calls with OpenTelemetry spans.
 * Non-function properties are accessed unchanged. Function properties are wrapped to create spans.
 *
 * The span name is `${serviceName}.${methodName}`, and each span includes a `service.implementation`
 * attribute set to the target's `constructor.name`.
 *
 * @param target - The object to wrap
 * @param serviceName - The name to use in span names (e.g., "QuoteSource")
 * @returns A Proxy that instruments method calls on the target
 *
 * @example
 * const quoteSource = new JsonQuoteSource(path);
 * const proxied = tracedProxy(quoteSource, "QuoteSource");
 * // Calling proxied.getQuote() creates a span named "QuoteSource.getQuote"
 */
export function tracedProxy<T extends object>(target: T, serviceName: string): T {
  return new Proxy(target, {
    get(target: T, prop: string | symbol, receiver: ProxyHandler<T>): unknown {
      const propValue = Reflect.get(target, prop, receiver);

      // If the property is not a function, return it unchanged (AC3.3)
      if (typeof propValue !== "function") {
        return propValue;
      }

      // Wrap the function with span instrumentation
      const originalFn = propValue as (...args: unknown[]) => unknown;
      const methodName = String(prop);
      const spanName = `${serviceName}.${methodName}`;

      return function (...args: unknown[]): unknown {
        // Get the tracer lazily at invocation time to ensure the SDK is registered
        const tracer = trace.getTracer("@unquote/api");
        const result = tracer.startActiveSpan(spanName, (span: Span) => {
          try {
            // Set the service.implementation attribute (AC3.2)
            span.setAttribute("service.implementation", target.constructor.name);

            // Call the original method with the target as 'this' context
            const methodResult = Reflect.apply(originalFn, target, args);

            // Check if result is thenable (Promise-like) for async detection
            if (
              methodResult !== null &&
              typeof methodResult === "object" &&
              "then" in methodResult &&
              typeof methodResult.then === "function"
            ) {
              // Handle async result
              const promise = methodResult as unknown as Promise<unknown>;
              return promise
                .then((value) => {
                  span.end();
                  return value;
                })
                .catch((error: unknown) => {
                  recordException(span, error);
                  span.setStatus({ code: SpanStatusCode.ERROR });
                  span.end();
                  throw error;
                });
            } else {
              // Handle sync result
              span.end();
              return methodResult;
            }
          } catch (error) {
            recordException(span, error);
            span.setStatus({ code: SpanStatusCode.ERROR });
            span.end();
            throw error;
          }
        });

        return result;
      };
    },
  });
}

/**
 * Helper function to safely record exceptions with proper typing.
 */
function recordException(span: Span, error: unknown): void {
  if (error instanceof Error || typeof error === "string") {
    span.recordException(error);
  } else {
    span.recordException(new Error(String(error)));
  }
}
