import { trace, SpanStatusCode } from "@opentelemetry/api";
import type { Span } from "@opentelemetry/api";

const tracer = trace.getTracer("@unquote/game-generator");

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
    const className = this.constructor.name;
    const spanName = `${className}.${methodName}`;

    const result = tracer.startActiveSpan(spanName, (span) => {
      try {
        const methodResult = target.call(this, ...args);

        // Check if result is a thenable (Promise-like)
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

    return result as Return;
  };
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
    const result = tracer.startActiveSpan(name, (span) => {
      try {
        const fnResult = fn(span, ...args);

        // Check if result is a thenable (Promise-like)
        if (
          fnResult !== null &&
          typeof fnResult === "object" &&
          "then" in fnResult &&
          typeof fnResult.then === "function"
        ) {
          // Handle async result
          const promise = fnResult as unknown as Promise<unknown>;
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
          return fnResult;
        }
      } catch (error) {
        recordException(span, error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.end();
        throw error;
      }
    });

    return result as Return;
  };
}

export { traced, withSpan };
