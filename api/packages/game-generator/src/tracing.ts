import { trace, SpanStatusCode } from "@opentelemetry/api";
import type { Span } from "@opentelemetry/api";

const tracer = trace.getTracer("@unquote/game-generator");

/**
 * Execute a callback inside an active span, handling sync/async results and errors.
 * This is the shared core for both `traced` and `withSpan`.
 */
function executeInSpan<R>(name: string, callback: (span: Span) => R): R {
  const result = tracer.startActiveSpan(name, (span) => {
    try {
      const callbackResult = callback(span);

      if (
        callbackResult !== null &&
        typeof callbackResult === "object" &&
        "then" in callbackResult &&
        typeof callbackResult.then === "function"
      ) {
        const promise = callbackResult as unknown as Promise<unknown>;
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
        span.end();
        return callbackResult;
      }
    } catch (error) {
      recordException(span, error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
      throw error;
    }
  });

  return result as R;
}

function recordException(span: Span, error: unknown): void {
  if (error instanceof Error || typeof error === "string") {
    span.recordException(error);
  } else {
    span.recordException(new Error(String(error)));
  }
}

/**
 * Class method decorator that wraps the method with automatic span creation.
 * The span name is derived from the class name and method name.
 *
 * @example
 * class MyClass {
 *   @traced
 *   async myMethod() {
 *     return "result";
 *   }
 * }
 */
function traced<This extends { constructor: { name: string } }, Args extends Array<unknown>, Return>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext,
): (this: This, ...args: Args) => Return {
  const methodName = String(context.name);

  return function (this: This, ...args: Args): Return {
    const spanName = `${this.constructor.name}.${methodName}`;
    return executeInSpan(spanName, () => target.call(this, ...args));
  };
}

/**
 * Higher-order function that wraps a standalone function with automatic span creation.
 * The span is passed as the first argument to the wrapped function.
 *
 * @example
 * const tracedFunction = withSpan("myOperation", (span, arg1, arg2) => {
 *   return arg1 + arg2;
 * });
 *
 * const result = tracedFunction(1, 2); // Span is created and passed automatically
 */
function withSpan<Args extends Array<unknown>, Return>(
  name: string,
  fn: (span: Span, ...args: Args) => Return,
): (...args: Args) => Return {
  return (...args: Args): Return => {
    return executeInSpan(name, (span) => fn(span, ...args));
  };
}

export { traced, withSpan };
