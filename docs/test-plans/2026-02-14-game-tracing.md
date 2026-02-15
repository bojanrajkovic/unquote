# Game Tracing - Human Test Plan

## Prerequisites

- The API is built and runnable locally (`cd api && pnpm run build`)
- An OTLP-compatible collector is running (e.g., Jaeger all-in-one at `http://localhost:4318`)
- A valid `quotes.json` file exists at a known path
- All automated tests pass: `cd api && pnpm run test` (287 tests across 27 files)

## Phase 1: Verify instrumentation.ts is unmodified

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `git diff a3157d0..HEAD -- api/packages/api/src/instrumentation.ts` | Empty output (no changes to instrumentation file) |

## Phase 2: Verify auto-instrumentation still produces HTTP and Fastify spans

| Step | Action | Expected |
|------|--------|----------|
| 1 | Start the API with the OTLP exporter: `QUOTES_FILE_PATH=./resources/quotes.json OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 node --import ./dist/instrumentation.js dist/index.js` from the `api/packages/api` directory | Server starts on port 3000 without errors |
| 2 | Issue a GET request: `curl http://localhost:3000/game/today` | Valid JSON response with `encryptedText`, `mapping`, and `hints` fields |
| 3 | Open Jaeger UI at `http://localhost:16686`, select the service name, and search for traces | A trace appears for the `GET /game/today` request |
| 4 | Expand the trace | Root span is an HTTP span from `@opentelemetry/instrumentation-http` (e.g., `GET`). A Fastify span appears as a child (e.g., `request handler - /game/today`) |
| 5 | Inspect children of the Fastify span | New custom spans appear: `KeywordCipherGenerator.generateDailyPuzzle`, `KeywordCipherGenerator.generatePuzzle`, `buildCipherAlphabet`, `buildCipherMapping`, `eliminateSelfMappings`, `encryptText`, `generateHints` |
| 6 | Check the server's stdout/stderr log output for the request | Each log line includes `trace_id`, `span_id`, and `trace_flags` fields (Pino log correlation) |

## Phase 3: Verify solution checking spans

| Step | Action | Expected |
|------|--------|----------|
| 1 | From the `GET /game/today` response, extract the `id` field | A string like `"abc123"` |
| 2 | Issue a POST request with an incorrect solution: `curl -X POST http://localhost:3000/game/<id>/check -H 'Content-Type: application/json' -d '{"solution":"wrong answer"}'` | JSON response with `correct: false` |
| 3 | In Jaeger, search for the new trace for `POST /game/:id/check` | A trace appears with HTTP and Fastify spans |
| 4 | Expand the trace | A `validateSolution` span appears as a child within the call tree |
| 5 | Issue a POST request with the correct solution (the original plaintext from the puzzle's source quote) | JSON response with `correct: true` |
| 6 | Verify the trace in Jaeger for this correct-solution request | Same span structure with `validateSolution` span present |

## Phase 4: Verify tracedProxy DI integration spans

| Step | Action | Expected |
|------|--------|----------|
| 1 | In Jaeger, examine the full trace for `GET /game/today` | Spans named `QuoteSource.getRandomQuote` and `KeywordSource.getKeywords` appear (these are DI services wrapped by `tracedProxy`) |
| 2 | Click on `QuoteSource.getRandomQuote` span | The span has an attribute `service.implementation` with value `JsonQuoteSource` |
| 3 | Click on `KeywordSource.getKeywords` span | The span has an attribute `service.implementation` with value `StaticKeywordSource` |

## End-to-End: Full puzzle lifecycle trace continuity

**Purpose:** Validate that a single user request produces a complete, connected trace from HTTP through Fastify through DI services through game-generator internals.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Clear all traces in Jaeger (or note the current time) | Clean starting point |
| 2 | `curl http://localhost:3000/game/2026-02-14` | Valid puzzle JSON response |
| 3 | Find the trace in Jaeger | Exactly one trace with a single `trace_id` |
| 4 | Count the span depth | At least 4 levels deep: HTTP -> Fastify -> `generateDailyPuzzle` -> `generatePuzzle` -> child spans |
| 5 | Verify every span shares the same `trace_id` | All spans in the waterfall have identical `trace_id` values |
| 6 | Verify parent-child chain is unbroken | Each child span's `parentSpanId` matches its visual parent's `spanId` -- no orphaned spans |

## Traceability

| Acceptance Criterion | Automated Test | Manual Step |
|----------------------|----------------|-------------|
| AC1.1-AC1.5 | `tracing.test.ts` | -- |
| AC2.1-AC2.5 | `tracing.test.ts` | -- |
| AC3.1 | `traced-proxy.test.ts` | Phase 4 steps 1-3 |
| AC3.2 | `traced-proxy.test.ts` | Phase 4 steps 2-3 |
| AC3.3-AC3.5 | `traced-proxy.test.ts` | -- |
| AC4.1 | `tracing.integration.test.ts` | End-to-End steps 1-6 |
| AC4.2 | `tracing.integration.test.ts` | Phase 3 steps 1-4 |
| AC4.3 | `tracing.integration.test.ts` | -- |
| AC5.1 | 162 game-generator tests | -- |
| AC5.2 | 125 API tests | -- |
| AC5.3 | -- | Phase 2 steps 1-6 |
