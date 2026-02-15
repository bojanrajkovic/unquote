# Game Tracing Design

## Summary

This design introduces OpenTelemetry distributed tracing for the game generation and puzzle validation flows in the Unquote API. The instrumentation produces a detailed call-tree trace showing the complete execution path from HTTP request through puzzle generation (quote selection, cipher building, encryption, hint generation) to response. The implementation uses three lightweight abstractions — a `@traced` class method decorator, a `withSpan` function wrapper, and a `tracedProxy` for dependency-injected services — to avoid polluting business logic with manual tracing ceremony.

The instrumentation is implemented in two tiers: inside the `game-generator` package (using `@traced` for class methods and `withSpan` for pure functions), and at the API dependency injection boundary (using `tracedProxy` to wrap Awilix-registered services). The `game-generator` package takes a dependency on `@opentelemetry/api` (a no-op API layer that is transparent without an SDK), while the API package's existing `NodeSDK` setup provides span export and context propagation via `AsyncLocalStorage`. All existing auto-instrumentation (Fastify, HTTP, Pino) remains unchanged.

## Definition of Done

Game generation, puzzle checking, and their internal operations (cipher building, encryption, hint generation, solution validation) are instrumented with OpenTelemetry custom spans — producing a full call-tree trace for each request. The instrumentation uses lightweight abstractions (`@traced` decorator for class methods, `withSpan` wrapper for standalone functions, `tracedProxy` for DI boundaries) so that business logic is not polluted with manual `startActiveSpan`/`span.end()` ceremony. The `game-generator` package depends on `@opentelemetry/api` (no-op without SDK). Span access for custom attributes is available via callback parameter (`withSpan`) or `trace.getActiveSpan()` (`@traced`). Existing auto-instrumentation (HTTP, Fastify, Pino) remains unchanged.

## Acceptance Criteria

### game-tracing.AC1: `@traced` decorator produces correct spans for class methods
- **game-tracing.AC1.1 Success:** `@traced` creates a span named `ClassName.methodName` for a decorated async method
- **game-tracing.AC1.2 Success:** `@traced` creates a span named `ClassName.methodName` for a decorated sync method
- **game-tracing.AC1.3 Success:** `trace.getActiveSpan()` inside a `@traced` method returns the span the decorator created
- **game-tracing.AC1.4 Failure:** When the decorated method throws, the span records the exception and re-throws
- **game-tracing.AC1.5 Edge:** When no OTel SDK is registered, `@traced` is a transparent no-op (method executes normally)

### game-tracing.AC2: `withSpan` wrapper produces correct spans for standalone functions
- **game-tracing.AC2.1 Success:** `withSpan` creates a span with the given name and passes the `Span` as the first argument to the wrapped function
- **game-tracing.AC2.2 Success:** The external call signature of a `withSpan`-wrapped function does not include the `Span` parameter
- **game-tracing.AC2.3 Success:** `withSpan` handles both sync and async return values correctly
- **game-tracing.AC2.4 Failure:** When the wrapped function throws, the span records the exception and re-throws
- **game-tracing.AC2.5 Edge:** When no OTel SDK is registered, `withSpan` is a transparent no-op

### game-tracing.AC3: `tracedProxy` wraps DI services correctly
- **game-tracing.AC3.1 Success:** All method calls on a proxied service produce spans named `serviceName.methodName` (using the explicitly passed `serviceName`)
- **game-tracing.AC3.2 Success:** Each span includes a `service.implementation` attribute with the target's `constructor.name`
- **game-tracing.AC3.3 Success:** Non-function property access on a proxied service is not affected
- **game-tracing.AC3.4 Failure:** When a proxied method throws, the span records the exception and re-throws
- **game-tracing.AC3.5 Edge:** When no OTel SDK is registered, the proxy is transparent

### game-tracing.AC4: Full call-tree trace for game operations
- **game-tracing.AC4.1 Success:** `generateDailyPuzzle` produces a span tree with child spans for `getRandomQuote`, `generatePuzzle`, `getKeywords`, `buildCipherAlphabet`, `buildCipherMapping`, `eliminateSelfMappings`, `encryptText`, and `generateHints`
- **game-tracing.AC4.2 Success:** `validateSolution` produces a span when called
- **game-tracing.AC4.3 Success:** Custom attributes set via `trace.getActiveSpan()` or the `withSpan` callback appear on the correct spans

### game-tracing.AC5: Existing behavior is preserved
- **game-tracing.AC5.1 Success:** All existing game-generator tests pass without modification
- **game-tracing.AC5.2 Success:** All existing API tests pass without modification
- **game-tracing.AC5.3 Success:** Existing auto-instrumentation (HTTP, Fastify, Pino, Undici) continues to function

## Glossary

- **OpenTelemetry (OTel)**: Observability framework for generating, collecting, and exporting telemetry data (traces, metrics, logs). Provides vendor-neutral APIs and SDKs.
- **Span**: A single operation within a trace, representing a unit of work with a start time, end time, and metadata. Spans form parent-child relationships to create a call tree.
- **Tracer**: An OTel API object that creates spans. Obtained via `trace.getTracer(name)`.
- **NodeSDK**: OpenTelemetry SDK for Node.js that registers instrumentation libraries, context managers, and exporters in a single setup call.
- **AsyncLocalStorage**: Node.js API for tracking asynchronous context across function calls and promise chains. Used by OTel to propagate the active span without explicit parameter passing.
- **Auto-instrumentation**: OTel libraries that automatically wrap existing frameworks (Fastify, HTTP, Undici) to create spans without code changes.
- **Decorator**: TypeScript/JavaScript feature for annotating and modifying classes and methods. Uses `@decoratorName` syntax. Stage 3 decorators are the current standard.
- **Higher-order function (HOF)**: A function that takes a function as an argument or returns a function as a result. Used here to wrap standalone functions with tracing logic.
- **Proxy**: JavaScript object that intercepts operations (property access, method calls) on a target object. Used here to add tracing to DI-resolved services without modifying their code.
- **Awilix**: Dependency injection container library used in the API. Manages singleton and request-scoped service instances.
- **Call tree**: A hierarchical representation of function calls showing parent-child relationships. OTel traces visualize call trees via nested spans.
- **Cipher alphabet**: The scrambled 26-letter alphabet used to encrypt a quote in a cryptoquip puzzle.
- **Keyword cipher**: A cipher construction method that starts with a keyword (repeated letters removed) followed by the remaining alphabet letters in order.

## Architecture

Two-tier instrumentation using three lightweight abstractions that share a single `@opentelemetry/api` tracer and rely on `AsyncLocalStorage` (already configured by the existing `NodeSDK` setup) for automatic parent-child span linking.

**Tier 1 — Inside `game-generator`:** A `@traced` class method decorator and a `withSpan` function wrapper, both defined in a new `src/tracing.ts` module. These instrument the full call tree: `KeywordCipherGenerator` methods via `@traced`, and module-level pure functions (`buildCipherAlphabet`, `buildCipherMapping`, `eliminateSelfMappings`, `encryptText`, `generateHints`, `validateSolution`) via `withSpan`.

**Tier 2 — At the API DI boundary:** A `tracedProxy` factory that wraps Awilix-resolved services in a `Proxy`. Applied at registration time in `deps/singleton.ts` to `quoteSource` and `keywordSource`. Not applied to `gameGenerator` since it already uses `@traced` internally.

### Tracing abstractions

**`@traced`** — Stage 3 class method decorator. Auto-names spans as `ClassName.methodName` using `context.name` (method) and `this.constructor.name` (class) at runtime. Handles sync/async, records exceptions, ends spans on completion. Span access for custom attributes via `trace.getActiveSpan()` inside the method body.

**`withSpan(name, fn)`** — Higher-order function wrapper for standalone functions. The wrapped function receives the `Span` as its first parameter (stripped from the external call signature). Handles sync/async, records exceptions, ends spans on completion.

**`tracedProxy(target, serviceName)`** — `Proxy`-based wrapper for DI-resolved services. Intercepts all method calls and wraps each in a span named `serviceName.methodName`, with a `service.implementation` attribute set to the target's `constructor.name`. Applied once at registration, covers all current and future public methods on the proxied service.

### Contracts

```typescript
// packages/game-generator/src/tracing.ts

import type { Span } from '@opentelemetry/api';

// Stage 3 class method decorator — auto-names as ClassName.methodName
export function traced<This, Args extends unknown[], Return>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext,
): (this: This, ...args: Args) => Return;

// HOF wrapper — span injected as first arg, stripped from external signature
export function withSpan<Args extends unknown[], Return>(
  name: string,
  fn: (span: Span, ...args: Args) => Return,
): (...args: Args) => Return;
```

```typescript
// packages/api/src/tracing/traced-proxy.ts

// Proxy wrapper for DI-resolved services
export function tracedProxy<T extends object>(target: T, serviceName: string): T;
```

### Data flow

A `GET /game/today` request produces this trace tree:

```
GET /game/today                                    ← Fastify auto-instrumentation
  └─ KeywordCipherGenerator.generateDailyPuzzle    ← @traced
       ├─ QuoteSource.getRandomQuote               ← tracedProxy
       └─ KeywordCipherGenerator.generatePuzzle    ← @traced
            ├─ KeywordSource.getKeywords            ← tracedProxy
            ├─ buildCipherAlphabet                  ← withSpan
            ├─ buildCipherMapping                   ← withSpan
            │    └─ eliminateSelfMappings           ← withSpan
            ├─ encryptText                          ← withSpan
            └─ generateHints                        ← withSpan

POST /game/:id/check                               ← Fastify auto-instrumentation
  └─ KeywordCipherGenerator.generateDailyPuzzle    ← @traced (regenerate to get quote)
       └─ ...same subtree...
  └─ validateSolution                              ← withSpan
```

### Dependency impact

`game-generator` gains one new dependency: `@opentelemetry/api`. This is a thin API-only package (~50KB) designed for library use — all calls are no-ops when no SDK is registered (tests, standalone usage). The API package already has `@opentelemetry/api` transitively.

## Existing Patterns

Investigation found existing OTel setup in `packages/api/src/instrumentation.ts` using `NodeSDK` with selective auto-instrumentations (HTTP, Fastify, Pino, Undici). The SDK registers `AsyncLocalStorageContextManager` automatically, which is what enables parent-child span linking without explicit context passing.

Pino instrumentation already injects `trace_id`, `span_id`, and `trace_flags` into log entries via custom keys — logs are already correlated to traces.

The Awilix DI plugin (`deps/plugin.ts`) uses `onRequest`/`onResponse` hooks for request-scoped containers. The `tracedProxy` pattern follows this existing hook-based lifecycle approach — wrapping at registration rather than at call sites.

No existing custom spans or manual tracing code exists in the codebase. This design introduces the first custom instrumentation.

## Implementation Phases

<!-- START_PHASE_1 -->
### Phase 1: Tracing utilities in game-generator

**Goal:** Create the `@traced` decorator and `withSpan` wrapper in `game-generator`, add `@opentelemetry/api` dependency.

**Components:**
- `packages/game-generator/src/tracing.ts` — `traced` decorator, `withSpan` wrapper, shared tracer instance
- `packages/game-generator/package.json` — add `@opentelemetry/api` dependency

**Dependencies:** None (first phase)

**Done when:** `pnpm install` succeeds, `pnpm run build` succeeds in game-generator, and tests verify that `@traced` and `withSpan` produce spans when a SDK is registered and are no-ops when no SDK is present.
<!-- END_PHASE_1 -->

<!-- START_PHASE_2 -->
### Phase 2: Instrument game-generator functions

**Goal:** Apply `@traced` to `KeywordCipherGenerator` methods and `withSpan` to all module-level pure functions.

**Components:**
- `packages/game-generator/src/cipher/keyword-cipher.ts` — `@traced` on `generatePuzzle` and `generateDailyPuzzle`; `withSpan` on `buildCipherAlphabet`, `buildCipherMapping`, `eliminateSelfMappings`, `encryptText`
- `packages/game-generator/src/validation.ts` — `withSpan` on `validateSolution`
- `packages/game-generator/src/hints/generator.ts` — `withSpan` on `generateHints`

**Dependencies:** Phase 1

**Done when:** Build succeeds, existing tests still pass (instrumentation is transparent), and a test with a registered SDK verifies the expected span tree is produced for `generateDailyPuzzle`.
<!-- END_PHASE_2 -->

<!-- START_PHASE_3 -->
### Phase 3: DI proxy and API integration

**Goal:** Create `tracedProxy` utility in the API package and apply it to DI-registered services.

**Components:**
- `packages/api/src/tracing/traced-proxy.ts` — `tracedProxy` factory function
- `packages/api/src/deps/singleton.ts` — wrap `quoteSource` and `keywordSource` with `tracedProxy` at registration

**Dependencies:** Phase 2

**Done when:** Build succeeds, existing API tests pass, and a test verifies that proxied services produce spans with correct `serviceName.methodName` naming.
<!-- END_PHASE_3 -->

## Additional Considerations

**Span noise management:** Pure functions like `buildCipherAlphabet` execute in microseconds. If span volume becomes a concern, `withSpan` wrappers can be removed from individual functions without affecting the rest of the instrumentation — each wrapper is independent.

**No changes to instrumentation.ts:** The existing `NodeSDK` setup, auto-instrumentations, and OTLP exporter configuration are untouched. Custom spans automatically flow through the existing pipeline.
