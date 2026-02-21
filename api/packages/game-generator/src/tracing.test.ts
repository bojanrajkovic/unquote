import { describe, it, expect, beforeEach, vi } from "vitest";
import { SpanStatusCode } from "@opentelemetry/api";
import type { Span } from "@opentelemetry/api";

// Helper to track spans created by the tracer
let createdSpans: { name: string; span: Span }[] = [];

// Create a mock span for testing
function createMockSpan(): Span {
  const span = {
    isRecording: () => true,
    setAttribute: vi.fn(),
    setAttributes: vi.fn(),
    addEvent: vi.fn(),
    recordException: vi.fn(),
    updateName: vi.fn(),
    end: vi.fn(),
    spanContext: () => ({
      traceId: "trace-id-123",
      spanId: "span-id-456",
      traceFlags: 1,
      traceState: undefined,
      isRemote: false,
    }),
    setStatus: vi.fn(),
  } as unknown as Span;
  return span;
}

// Mock trace module before importing traced/withSpan
vi.mock("@opentelemetry/api", async () => {
  const actual = await vi.importActual<typeof import("@opentelemetry/api")>("@opentelemetry/api");
  return {
    ...actual,
    trace: {
      ...actual!.trace,
      getTracer: vi.fn(() => {
        return {
          startActiveSpan(name: string, callback: (span: Span) => unknown): unknown {
            const span = createMockSpan();
            createdSpans.push({ name, span });
            return callback(span);
          },
        };
      }),
    },
  };
});

import { traced, withSpan } from "./tracing.js";

describe("tracing", () => {
  beforeEach(() => {
    createdSpans = [];
  });

  describe("@traced decorator", () => {
    it("game-tracing.AC1.1: creates a span named ClassName.methodName for async method", async () => {
      class TestClass {
        @traced
        async asyncMethod(): Promise<string> {
          return "async result";
        }
      }

      const instance = new TestClass();
      const result = await instance.asyncMethod();

      expect(result).toBe("async result");
      expect(createdSpans).toHaveLength(1);
      const span0 = createdSpans[0];
      expect(span0).toBeDefined();
      expect(span0!.name).toBe("TestClass.asyncMethod");
    });

    it("game-tracing.AC1.2: creates a span named ClassName.methodName for sync method", () => {
      class TestClass {
        @traced
        syncMethod(): string {
          return "sync result";
        }
      }

      const instance = new TestClass();
      const result = instance.syncMethod();

      expect(result).toBe("sync result");
      expect(createdSpans).toHaveLength(1);
      const span0 = createdSpans[0];
      expect(span0).toBeDefined();
      expect(span0!.name).toBe("TestClass.syncMethod");
    });

    it("game-tracing.AC1.3: trace.getActiveSpan() inside @traced method returns the decorator's span", () => {
      let capturedSpan: Span | undefined;

      class TestClass {
        @traced
        captureSpan(): string {
          capturedSpan = createdSpans[0]?.span;
          return "captured";
        }
      }

      const instance = new TestClass();
      instance.captureSpan();

      expect(createdSpans).toHaveLength(1);
      const span0 = createdSpans[0];
      expect(span0).toBeDefined();
      expect(capturedSpan).toBe(span0!.span);
    });

    it("game-tracing.AC1.4: records exception when decorated method throws", () => {
      class TestClass {
        @traced
        throwingMethod() {
          throw new Error("test error");
        }
      }

      const instance = new TestClass();
      expect(() => instance.throwingMethod()).toThrow("test error");

      expect(createdSpans).toHaveLength(1);
      const span0 = createdSpans[0];
      expect(span0).toBeDefined();
      const mockSpan = span0!.span;
      expect(mockSpan.recordException).toHaveBeenCalled();
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
      });
    });

    it("game-tracing.AC1.4: records exception when async decorated method throws", async () => {
      class TestClass {
        @traced
        async asyncThrowingMethod(): Promise<void> {
          throw new Error("async test error");
        }
      }

      const instance = new TestClass();
      await expect(instance.asyncThrowingMethod()).rejects.toThrow("async test error");

      expect(createdSpans).toHaveLength(1);
      const span0 = createdSpans[0];
      expect(span0).toBeDefined();
      const mockSpan = span0!.span;
      expect(mockSpan.recordException).toHaveBeenCalled();
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
      });
    });

    it("game-tracing.AC1.5: without OTel SDK registered, @traced is transparent no-op", () => {
      class TestClass {
        @traced
        method(): string {
          return "no-op result";
        }
      }

      const instance = new TestClass();
      const result = instance.method();

      expect(result).toBe("no-op result");
    });
  });

  describe("withSpan wrapper", () => {
    it("game-tracing.AC2.1: creates a span with given name and passes Span as first argument", () => {
      let receivedSpan: Span | null = null;

      const wrappedFn = withSpan("myOperation", (span, value: unknown) => {
        receivedSpan = span;
        return (value as number) + 1;
      });

      const result = wrappedFn(5);

      expect(result).toBe(6);
      expect(receivedSpan).toBeDefined();
      expect(createdSpans).toHaveLength(1);
      const span0 = createdSpans[0];
      expect(span0).toBeDefined();
      expect(span0!.name).toBe("myOperation");
    });

    it("game-tracing.AC2.2: external call signature does not include Span parameter", () => {
      const wrappedFn = withSpan("operation", (_span, a: unknown, b: unknown) => {
        return (a as number) + (b as number);
      });

      const result = wrappedFn(2, 3);
      expect(result).toBe(5);
    });

    it("game-tracing.AC2.3: handles both sync and async return values correctly", async () => {
      const syncWrapped = withSpan("syncOp", () => {
        return "sync result";
      });

      const asyncWrapped = withSpan("asyncOp", () => {
        return Promise.resolve("async result");
      });

      const syncResult = syncWrapped();
      const asyncResult = await asyncWrapped();

      expect(syncResult).toBe("sync result");
      expect(asyncResult).toBe("async result");

      expect(createdSpans).toHaveLength(2);
      const span0 = createdSpans[0];
      expect(span0).toBeDefined();
      expect(span0!.name).toBe("syncOp");
      const span1 = createdSpans[1];
      expect(span1).toBeDefined();
      expect(span1!.name).toBe("asyncOp");
    });

    it("game-tracing.AC2.4: records exception when wrapped function throws", () => {
      const wrappedFn = withSpan("failOperation", () => {
        throw new Error("wrapped error");
      });

      expect(() => wrappedFn()).toThrow("wrapped error");

      expect(createdSpans).toHaveLength(1);
      const span0 = createdSpans[0];
      expect(span0).toBeDefined();
      const mockSpan = span0!.span;
      expect(mockSpan.recordException).toHaveBeenCalled();
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
      });
    });

    it("game-tracing.AC2.4: records exception when async wrapped function throws", async () => {
      const wrappedFn = withSpan("asyncFailOperation", () => {
        return Promise.reject(new Error("async wrapped error"));
      });

      await expect(wrappedFn()).rejects.toThrow("async wrapped error");

      expect(createdSpans).toHaveLength(1);
      const span0 = createdSpans[0];
      expect(span0).toBeDefined();
      const mockSpan = span0!.span;
      expect(mockSpan.recordException).toHaveBeenCalled();
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
      });
    });

    it("game-tracing.AC2.5: without OTel SDK registered, withSpan is transparent no-op", () => {
      const wrappedFn = withSpan("noOpOperation", (_span, value: unknown) => {
        return (value as number) * 2;
      });

      const result = wrappedFn(5);

      expect(result).toBe(10);
    });
  });

  describe("integration scenarios", () => {
    it("handles nested spans correctly", () => {
      class OuterClass {
        @traced
        outerMethod(): string {
          return this.innerMethod();
        }

        @traced
        innerMethod(): string {
          return "inner";
        }
      }

      const instance = new OuterClass();
      const result = instance.outerMethod();

      expect(result).toBe("inner");

      expect(createdSpans).toHaveLength(2);
      const span0 = createdSpans[0];
      expect(span0).toBeDefined();
      expect(span0!.name).toBe("OuterClass.outerMethod");
      const span1 = createdSpans[1];
      expect(span1).toBeDefined();
      expect(span1!.name).toBe("OuterClass.innerMethod");
    });

    it("mixed @traced and withSpan creates correct span hierarchy", async () => {
      const tracedWrapped = withSpan("wrappedOperation", () => {
        class Inner {
          @traced
          innerMethod(): string {
            return "result";
          }
        }

        return new Inner().innerMethod();
      });

      const result = await tracedWrapped();

      expect(result).toBe("result");

      expect(createdSpans).toHaveLength(2);
      const span0 = createdSpans[0];
      expect(span0).toBeDefined();
      expect(span0!.name).toBe("wrappedOperation");
      const span1 = createdSpans[1];
      expect(span1).toBeDefined();
      expect(span1!.name).toBe("Inner.innerMethod");
    });
  });
});
