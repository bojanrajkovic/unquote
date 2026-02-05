import { register } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

// Register ESM loader hook for OpenTelemetry instrumentation (Node 24+)
// Must be called before importing any modules that need instrumentation
register("@opentelemetry/instrumentation/hook.mjs", pathToFileURL(import.meta.url).href);

import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";

// Enable diagnostic logging if OTEL_DEBUG is set
if (process.env["OTEL_DEBUG"]) {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

// Read service metadata from package.json using fs for ESM compatibility
const currentDir = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(currentDir, "../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
  name: string;
  version: string;
};

const serviceName = packageJson.name;
const serviceVersion = packageJson.version;

// Configure OTLP exporter - only if endpoint is configured
const otlpEndpoint = process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];

// Create SDK with auto-instrumentations
const sdkConfig = {
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
  }),
  ...(otlpEndpoint && {
    traceExporter: new OTLPTraceExporter({
      url: `${otlpEndpoint}/v1/traces`,
    }),
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Enable Fastify instrumentation (disabled by default in auto-instrumentations)
      "@opentelemetry/instrumentation-fastify": {
        enabled: true,
      },
      // Configure Pino instrumentation to add trace context to logs
      "@opentelemetry/instrumentation-pino": {
        logKeys: {
          traceId: "trace_id",
          spanId: "span_id",
          traceFlags: "trace_flags",
        },
      },
      // Disable fs instrumentation (too verbose)
      "@opentelemetry/instrumentation-fs": {
        enabled: false,
      },
    }),
  ],
};

const sdk = new NodeSDK(sdkConfig);

// Start the SDK
sdk.start();

// Graceful shutdown on SIGTERM
process.on("SIGTERM", async () => {
  try {
    await sdk.shutdown();
    console.log("OpenTelemetry SDK shutdown successfully");
  } catch (error) {
    console.error("Error shutting down OpenTelemetry SDK", error);
  }
});

console.log(`OpenTelemetry initialized: service=${serviceName}, version=${serviceVersion}`);
