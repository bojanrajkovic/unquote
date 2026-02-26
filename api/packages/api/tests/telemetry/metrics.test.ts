import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { RuntimeNodeInstrumentation } from "@opentelemetry/instrumentation-runtime-node";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";

// Enable stable HTTP semantic conventions for metric emission.
// Must be set before HttpInstrumentation is constructed.
process.env["OTEL_SEMCONV_STABILITY_OPT_IN"] = "http";

/**
 * Collect all unique metric names from the in-memory exporter.
 */
function collectMetricNames(exporter: InMemoryMetricExporter): string[] {
  return exporter
    .getMetrics()
    .flatMap((rm) => rm.scopeMetrics)
    .flatMap((sm) => sm.metrics)
    .map((m) => m.descriptor.name);
}

describe("runtime metrics integration", () => {
  let exporter: InMemoryMetricExporter;
  let reader: PeriodicExportingMetricReader;
  let meterProvider: MeterProvider;
  let runtimeInstrumentation: RuntimeNodeInstrumentation;

  beforeAll(async () => {
    exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
    reader = new PeriodicExportingMetricReader({
      exporter,
      exportIntervalMillis: 100,
    });
    meterProvider = new MeterProvider({ readers: [reader] });

    runtimeInstrumentation = new RuntimeNodeInstrumentation({
      monitoringPrecision: 10,
    });
    runtimeInstrumentation.setMeterProvider(meterProvider);
    runtimeInstrumentation.enable();

    // Allow at least one collection cycle to complete
    await new Promise((resolve) => setTimeout(resolve, 200));
    await reader.forceFlush();
  });

  afterAll(async () => {
    runtimeInstrumentation.disable();
    await reader.shutdown();
    await meterProvider.shutdown();
  });

  it("emits event loop delay metrics", () => {
    const names = collectMetricNames(exporter);

    expect(names).toContain("nodejs.eventloop.delay.min");
    expect(names).toContain("nodejs.eventloop.delay.max");
    expect(names).toContain("nodejs.eventloop.delay.mean");
    expect(names).toContain("nodejs.eventloop.delay.p50");
    expect(names).toContain("nodejs.eventloop.delay.p99");
  });

  it("emits event loop utilization metrics", () => {
    const names = collectMetricNames(exporter);

    expect(names).toContain("nodejs.eventloop.utilization");
    expect(names).toContain("nodejs.eventloop.time");
  });

  it("emits V8 heap memory metrics", () => {
    const names = collectMetricNames(exporter);

    expect(names).toContain("v8js.memory.heap.used");
    expect(names).toContain("v8js.memory.heap.limit");
  });

  it("reports non-zero heap usage across V8 heap spaces", () => {
    const heapMetric = exporter
      .getMetrics()
      .flatMap((rm) => rm.scopeMetrics)
      .flatMap((sm) => sm.metrics)
      .find((m) => m.descriptor.name === "v8js.memory.heap.used");

    expect(heapMetric).toBeDefined();

    // Each data point represents a different V8 heap space (old_space, new_space, etc.)
    expect(heapMetric!.dataPoints.length).toBeGreaterThan(1);

    const totalHeap = heapMetric!.dataPoints.reduce((sum, dp) => sum + Number(dp.value), 0);
    expect(totalHeap).toBeGreaterThan(0);
  });
});

describe("HTTP metrics integration", () => {
  let exporter: InMemoryMetricExporter;
  let reader: PeriodicExportingMetricReader;
  let meterProvider: MeterProvider;
  let httpInstrumentation: HttpInstrumentation;
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
    reader = new PeriodicExportingMetricReader({
      exporter,
      exportIntervalMillis: 100,
    });
    meterProvider = new MeterProvider({ readers: [reader] });

    httpInstrumentation = new HttpInstrumentation();
    httpInstrumentation.setMeterProvider(meterProvider);
    httpInstrumentation.enable();

    // Start a plain HTTP server (bypasses Fastify to isolate HTTP instrumentation)
    server = http.createServer((_req, res) => {
      res.writeHead(200);
      res.end("ok");
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as { port: number }).port;

    // Make a request so the instrumentation records metrics
    await new Promise<void>((resolve, reject) => {
      http
        .get(`http://127.0.0.1:${port}/test`, (res) => {
          res.on("data", () => {});
          res.on("end", () => resolve());
        })
        .on("error", reject);
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    await reader.forceFlush();
  });

  afterAll(async () => {
    httpInstrumentation.disable();
    server.close();
    await reader.shutdown();
    await meterProvider.shutdown();
  });

  it("emits http.server.request.duration", () => {
    const names = collectMetricNames(exporter);
    expect(names).toContain("http.server.request.duration");
  });

  it("emits http.client.request.duration", () => {
    const names = collectMetricNames(exporter);
    expect(names).toContain("http.client.request.duration");
  });

  it("records a server duration data point with correct attributes", () => {
    const serverMetric = exporter
      .getMetrics()
      .flatMap((rm) => rm.scopeMetrics)
      .flatMap((sm) => sm.metrics)
      .find((m) => m.descriptor.name === "http.server.request.duration");

    expect(serverMetric).toBeDefined();
    expect(serverMetric!.dataPoints.length).toBeGreaterThan(0);

    const dp = serverMetric!.dataPoints[0]!;
    expect(dp.attributes["http.request.method"]).toBe("GET");
    expect(dp.attributes["http.response.status_code"]).toBe(200);
  });
});
