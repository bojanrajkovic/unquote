import { describe, it, expect } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyOpenapi3, { oas3PluginAjv } from "@eropple/fastify-openapi3";

import { loggerOptions, logRequests } from "./logger.js";

type Line = Record<string, unknown>;

const isRouteLine = (l: Line): boolean => l["msg"] === "Building operation for route.";

async function buildLoggedFastify(level: string): Promise<{ fastify: FastifyInstance; lines: Line[] }> {
  const lines: Line[] = [];
  const fastify = Fastify({
    logger: { ...loggerOptions, level, stream: { write: (line: string) => void lines.push(JSON.parse(line)) } },
    requestIdLogLabel: "request_id",
    disableRequestLogging: true,
    ajv: { plugins: [oas3PluginAjv] },
  });
  logRequests(fastify);

  await fastify.register(fastifyOpenapi3, { openapiInfo: { title: "test", version: "0.0.0" } });
  fastify.get("/loud", async () => ({ ok: true }));
  fastify.get("/quiet", { logLevel: "warn" }, async () => ({ ok: true }));
  await fastify.ready();

  return { fastify, lines };
}

describe("logger", () => {
  it("writes the level as a name and service in place of pid and hostname", async () => {
    const { fastify, lines } = await buildLoggedFastify("info");

    fastify.log.info("hello");
    await fastify.close();

    const line = lines.find((l) => l["msg"] === "hello");
    expect(line).toMatchObject({ level: "info", service: "unquote" });
    expect(line).not.toHaveProperty("pid");
    expect(line).not.toHaveProperty("hostname");
  });

  it("logs the OpenAPI plugin's per-route line at debug", async () => {
    const atInfo = await buildLoggedFastify("info");
    await atInfo.fastify.close();
    const atDebug = await buildLoggedFastify("debug");
    await atDebug.fastify.close();

    expect(atInfo.lines.filter(isRouteLine)).toEqual([]);

    const routeLines = atDebug.lines.filter(isRouteLine);
    expect(routeLines.length).toBeGreaterThan(0);
    expect(routeLines.every((l) => l["level"] === "debug" && l["plugin"] === "OAS3Plugin")).toBe(true);
  });

  it("logs one line per request with top-level HTTP fields and the full URL", async () => {
    const { fastify, lines } = await buildLoggedFastify("info");

    await fastify.inject({ method: "GET", url: "/loud?a=1" });
    await fastify.close();

    const requestLines = lines.filter((l) => "request_id" in l);
    expect(requestLines).toHaveLength(1);
    expect(requestLines[0]).toMatchObject({
      level: "info",
      msg: "request completed",
      http_method: "GET",
      url: "/loud?a=1",
      http_status: 200,
      request_id: expect.any(String),
      duration_ms: expect.any(Number),
    });
    expect(requestLines[0]).not.toHaveProperty("req");
    expect(requestLines[0]).not.toHaveProperty("res");
    expect(requestLines[0]).not.toHaveProperty("responseTime");
  });

  it("logs no request line for a route with logLevel warn", async () => {
    const { fastify, lines } = await buildLoggedFastify("info");

    await fastify.inject({ method: "GET", url: "/quiet" });
    await fastify.close();

    expect(lines.filter((l) => "request_id" in l)).toEqual([]);
  });
});
