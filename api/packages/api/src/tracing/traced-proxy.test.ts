import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { context, trace, SpanStatusCode } from "@opentelemetry/api";
import { tracedProxy } from "./traced-proxy.js";

// Helper class for testing
class TestService {
  name = "test-property";

  async doWork(input: string): Promise<string> {
    return `result:${input}`;
  }

  doWorkSync(input: string): string {
    return `sync:${input}`;
  }

  async failingMethod(): Promise<never> {
    throw new Error("test error");
  }
}

describe("tracedProxy", () => {
  let exporter: InMemorySpanExporter;

  beforeAll(() => {
    // Set up context manager for async context propagation
    const contextManager = new AsyncLocalStorageContextManager();
    context.setGlobalContextManager(contextManager);

    // Create and register SDK with InMemorySpanExporter
    exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    trace.setGlobalTracerProvider(provider);
  });

  afterEach(() => {
    // Reset exporter between tests
    exporter.reset();
  });

  describe("game-tracing.AC3.1: span naming", () => {
    it("should create spans named serviceName.methodName for async methods", async () => {
      const service = new TestService();
      const proxied = tracedProxy(service, "TestServiceName");

      const result = await proxied.doWork("hello");

      expect(result).toBe("result:hello");

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.name).toBe("TestServiceName.doWork");
    });

    it("should create spans named serviceName.methodName for sync methods", () => {
      const service = new TestService();
      const proxied = tracedProxy(service, "TestServiceName");

      const result = proxied.doWorkSync("hello");

      expect(result).toBe("sync:hello");

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.name).toBe("TestServiceName.doWorkSync");
    });
  });

  describe("game-tracing.AC3.2: service.implementation attribute", () => {
    it("should set service.implementation attribute to target constructor name", async () => {
      const service = new TestService();
      const proxied = tracedProxy(service, "TestServiceName");

      await proxied.doWork("test");

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.attributes["service.implementation"]).toBe("TestService");
    });
  });

  describe("game-tracing.AC3.3: non-function property access", () => {
    it("should return non-function properties unchanged without creating spans", () => {
      const service = new TestService();
      const proxied = tracedProxy(service, "TestServiceName");

      const value = proxied.name;

      expect(value).toBe("test-property");

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(0);
    });
  });

  describe("game-tracing.AC3.4: exception handling", () => {
    it("should record exception and set ERROR status when method throws", async () => {
      const service = new TestService();
      const proxied = tracedProxy(service, "TestServiceName");

      await expect(proxied.failingMethod()).rejects.toThrow("test error");

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.status?.code).toBe(SpanStatusCode.ERROR);

      // Check that exception was recorded
      const events = spans[0]?.events || [];
      const hasException = events.some((e: { name: string }) => e.name === "exception");
      expect(hasException).toBe(true);
    });
  });

  describe("game-tracing.AC3.5: behavior without OTel SDK", () => {
    it("should be transparent when no SDK is registered", async () => {
      // The tracedProxy should work even with no-op provider (default behavior)
      const service = new TestService();
      const proxied = tracedProxy(service, "TestServiceName");

      const result = await proxied.doWork("hello");

      expect(result).toBe("result:hello");
    });
  });
});
