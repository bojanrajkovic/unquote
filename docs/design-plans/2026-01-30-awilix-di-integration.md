# Awilix Dependency Injection Integration Design

## Summary

This design integrates Awilix dependency injection into the Fastify API server, establishing a pattern for managing application-lifetime and request-scoped dependencies. The approach uses two container levels: a singleton cradle holding configuration, logging, and game services that live for the entire application lifetime, and a request cradle that inherits singletons but replaces the logger with a request-specific instance carrying OpenTelemetry trace context. Both containers are exposed through type-safe properties (`fastify.deps` and `request.deps`) via TypeScript module augmentation.

The implementation follows patterns from the concentric repository but simplifies the structure for unquote's needs—all DI wiring lives in a `deps/` folder with no async datastore pattern, and both access patterns use consistent property syntax. The design includes OpenTelemetry instrumentation loaded before application startup to ensure trace context propagates through logs, and configuration validation via `@fastify/env` with TypeBox schemas. Services like `GameGenerator` and `QuoteSource` from the game-generator package are eagerly initialized at startup to fail fast on misconfiguration (e.g., missing quotes file). Testing infrastructure uses Awilix's `createScope()` to inject test doubles without affecting the production container.

## Definition of Done

1. **Awilix DI container** integrated into Fastify with singleton and request-scoped cradles
2. **Type-safe access** via TypeScript module augmentation (`fastify.deps()`, `request.deps`)
3. **Configuration** loaded and validated via `@fastify/env` with TypeBox schema
4. **GameGenerator and QuoteSource** wired as singleton dependencies, eagerly initialized
5. **OpenTelemetry** instrumented with trace context propagated to request-scoped logger
6. **Test pattern** established using `createScope()` with test doubles
7. **Folder structure** following `deps/`, `config/` organization

**Explicitly out of scope:**
- Database connections
- User/leaderboard services
- Async datastore pattern
- Actual route implementations (just DI wiring for them to use)

## Glossary

- **Awilix**: Dependency injection container library for JavaScript/TypeScript that manages service lifecycles and resolves dependencies
- **Cradle**: Awilix term for the resolved object containing all registered dependencies in a container
- **DI (Dependency Injection)**: Design pattern where objects receive their dependencies from external sources rather than creating them internally
- **Eager initialization**: Pattern where services are constructed immediately at startup rather than on first use (lazy), causing immediate failure on misconfiguration
- **Fastify**: Fast and low-overhead web framework for Node.js
- **GameGenerator**: Core interface from game-generator package responsible for creating cryptoquip puzzles
- **Module augmentation**: TypeScript feature allowing addition of new properties/methods to existing type definitions from external modules
- **OpenTelemetry (OTel)**: Observability framework providing standardized APIs, SDKs, and tools for traces, metrics, and logs
- **OTLP (OpenTelemetry Protocol)**: Standard protocol for transmitting telemetry data to collectors/backends
- **Pino**: Fast JSON logger for Node.js, Fastify's default logging library
- **QuoteSource**: Interface from game-generator package that provides quotes for puzzle generation
- **Request-scoped**: Lifecycle where a new instance is created per HTTP request and disposed after response
- **Singleton**: Lifecycle where a single instance exists for the entire application lifetime
- **Trace context**: OpenTelemetry metadata (trace_id, span_id) linking related operations across service boundaries
- **TypeBox**: JSON schema builder and runtime type validation library with TypeScript integration
- **Type provider**: Fastify plugin that synchronizes runtime schema validation with TypeScript types

## Architecture

Awilix dependency injection integrated into Fastify following patterns from the [concentric](https://github.com/ed3dnet/concentric/) repository, adapted for unquote's simpler needs.

**Layers:**

```
instrumentation.ts (--import)     OpenTelemetry SDK, auto-instrumentations
        ↓
deps/singleton.ts                 AppSingletonCradle, root container
        ↓
deps/request.ts                   AppRequestCradle, per-request scope
        ↓
deps/plugin.ts                    Fastify plugin, attaches containers
```

**Container structure:**
- **Singleton cradle**: Application-lifetime dependencies (config, logger, quoteSource, gameGenerator)
- **Request cradle**: Inherits singleton, overrides logger with request-scoped instance (has trace context from OpenTelemetry)

**Access patterns:**
- `fastify.deps` — singleton cradle (property via getter)
- `request.deps` — request-scoped cradle (property)
- Both consistent property access, not mixed function/property

**File structure:**

```
api/packages/api/src/
├── instrumentation.ts      # OTel setup (loaded via --import)
├── config/
│   └── schema.ts           # TypeBox env schema
├── deps/
│   ├── index.ts            # Re-exports
│   ├── singleton.ts        # Singleton container + cradle type
│   ├── request.ts          # Request scope factory
│   ├── plugin.ts           # Fastify DI plugin
│   └── type-extensions.ts  # Fastify module augmentation
└── index.ts                # Server entry
```

**Key contracts:**

```typescript
// deps/singleton.ts
interface AppSingletonCradle {
  config: AppConfig;
  logger: Logger;
  quoteSource: QuoteSource;
  gameGenerator: GameGenerator;
}

// deps/request.ts
type AppRequestCradle = AppSingletonCradle;  // Same shape, different logger instance

// deps/type-extensions.ts
declare module "fastify" {
  interface FastifyInstance {
    readonly diContainer: AwilixContainer<AppSingletonCradle>;
    readonly deps: AppSingletonCradle;
  }
  interface FastifyRequest {
    diScope: AwilixContainer<AppRequestCradle>;
    deps: AppRequestCradle;
  }
}
```

**Initialization flow:**

1. `node --import ./dist/instrumentation.js ./dist/index.js`
2. `instrumentation.ts` starts OpenTelemetry SDK (before app loads)
3. `index.ts` creates Fastify instance (Pino logger created)
4. `@fastify/env` validates environment, creates `fastify.config`
5. `configureContainer(config, logger)` builds singleton container
6. `registerDependencyInjection(fastify, container)` attaches to Fastify
7. Routes registered, server listens

## Existing Patterns

Investigation found no existing DI or service layer patterns in the unquote API. The current codebase has minimal Fastify bootstrap with plugins only.

This design introduces patterns from concentric:
- Singleton + request-scoped Awilix containers
- Type augmentation for Fastify instances and requests
- Config validation via `@fastify/env`

Divergence from concentric:
- **Simplified structure**: No `lib/http-server/` nesting — all DI code in `deps/`
- **Consistent access**: Both `fastify.deps` and `request.deps` are properties (concentric uses function for instance, property for request)
- **No async datastore pattern**: Services constructed eagerly, not as `Promise<T>`

The game-generator package already has clean interfaces (`QuoteSource`, `GameGenerator`) ready for DI wiring.

## Implementation Phases

<!-- START_PHASE_1 -->
### Phase 1: Dependency Upgrades

**Goal:** Upgrade TypeBox to 1.0 and align all dependencies

**Components:**
- `pnpm-workspace.yaml` catalog updates
- `packages/api/package.json` dependency alignment
- `packages/game-generator/package.json` TypeBox migration

**Changes:**
- `@fastify/type-provider-typebox`: `^5.0.0` → `^6.1.0`
- `@sinclair/typebox`: `^0.34.0` → remove
- `typebox`: add `^1.0.13`
- Update imports from `@sinclair/typebox` to `typebox` in game-generator

**Dependencies:** None (first phase)

**Done when:** `pnpm install` succeeds, `pnpm run build` succeeds across all packages, `pnpm run test` passes
<!-- END_PHASE_1 -->

<!-- START_PHASE_2 -->
### Phase 2: OpenTelemetry Setup

**Goal:** Add OpenTelemetry instrumentation loaded before app startup

**Components:**
- `src/instrumentation.ts` — NodeSDK configuration, auto-instrumentations, graceful shutdown
- OpenTelemetry dependencies in `packages/api/package.json`

**Dependencies to add:**
- `@opentelemetry/api`
- `@opentelemetry/sdk-node`
- `@opentelemetry/auto-instrumentations-node`
- `@opentelemetry/exporter-trace-otlp-http`
- `@opentelemetry/resources`
- `@opentelemetry/semantic-conventions`

**Features:**
- Service name and version read from `package.json`
- OTLP exporter configurable via `OTEL_EXPORTER_OTLP_ENDPOINT`
- Auto-instrumentation for HTTP, Pino (trace context in logs)
- Graceful shutdown on SIGTERM

**Dependencies:** Phase 1 (TypeBox upgrade)

**Done when:** App starts with `node --import ./dist/instrumentation.js ./dist/index.js`, logs include `trace_id` and `span_id` fields
<!-- END_PHASE_2 -->

<!-- START_PHASE_3 -->
### Phase 3: Configuration Schema

**Goal:** Validated environment configuration via `@fastify/env`

**Components:**
- `src/config/schema.ts` — TypeBox schema for environment variables, `AppConfig` type export
- `@fastify/env` registration in `src/index.ts`

**Configuration fields:**
- `PORT` (number, default 3000)
- `HOST` (string, default "0.0.0.0")
- `LOG_LEVEL` (string, default "info")
- `QUOTES_FILE_PATH` (string, required)
- `OTEL_EXPORTER_OTLP_ENDPOINT` (string, optional)

**Dependencies:** Phase 1 (TypeBox 1.0)

**Done when:** Server fails fast on missing `QUOTES_FILE_PATH`, `fastify.config` is typed as `AppConfig`
<!-- END_PHASE_3 -->

<!-- START_PHASE_4 -->
### Phase 4: Singleton Container

**Goal:** Awilix singleton container with game services wired

**Components:**
- `src/deps/singleton.ts` — `AppSingletonCradle` interface, `configureContainer()` factory
- `src/deps/index.ts` — re-exports
- Awilix dependency in `packages/api/package.json`
- `@unquote/game-generator` dependency in `packages/api/package.json`

**Registered dependencies:**
- `config` — `asValue(config)`
- `logger` — `asValue(logger)`
- `quoteSource` — `asValue(new JsonQuoteSource(config.quotesFilePath))`
- `gameGenerator` — `asFunction(({ quoteSource }) => new KeywordCipherGenerator(quoteSource))`

**Dependencies:** Phase 3 (config schema)

**Done when:** Container can be created, `container.cradle.gameGenerator` returns functional GameGenerator, unit tests pass for container configuration
<!-- END_PHASE_4 -->

<!-- START_PHASE_5 -->
### Phase 5: Request Scope & Fastify Integration

**Goal:** Per-request DI scope with Fastify plugin and type augmentation

**Components:**
- `src/deps/request.ts` — `AppRequestCradle` type, `configureRequestScope()` factory
- `src/deps/plugin.ts` — `registerDependencyInjection()` Fastify plugin
- `src/deps/type-extensions.ts` — Fastify module augmentation

**Plugin behavior:**
- Attaches `diContainer` to Fastify instance
- Defines `deps` getter on Fastify instance
- Creates request scope in `onRequest` hook
- Disposes request scope in `onResponse` hook

**Dependencies:** Phase 4 (singleton container)

**Done when:** `fastify.deps.config` and `request.deps.logger` are typed and accessible, request-scoped logger has trace context from OTel
<!-- END_PHASE_5 -->

<!-- START_PHASE_6 -->
### Phase 6: Server Integration & Wiring

**Goal:** Wire DI into server startup, update entry point

**Components:**
- `src/index.ts` — updated `buildServer()` with DI initialization sequence
- npm scripts for `--import` flag

**Startup sequence:**
1. Create Fastify instance
2. Register `@fastify/env`
3. Call `configureContainer(fastify.config, fastify.log)`
4. Call `registerDependencyInjection(fastify, container)`
5. Register other plugins and routes

**Script updates:**
- `"start": "node --import ./dist/instrumentation.js ./dist/index.js"`
- `"dev": "tsx watch --import ./src/instrumentation.ts ./src/index.ts"`

**Dependencies:** Phase 5 (request scope)

**Done when:** Server starts successfully, health endpoint accessible, logs show trace context
<!-- END_PHASE_6 -->

<!-- START_PHASE_7 -->
### Phase 7: Testing Infrastructure

**Goal:** Establish test pattern using `createScope()` with test doubles

**Components:**
- `tests/helpers/test-container.ts` — `createTestContainer()` factory with mock defaults
- `tests/deps/singleton.test.ts` — unit tests for container configuration
- Example integration test demonstrating DI override pattern

**Test utilities:**
- Factory function accepting partial overrides
- Default mock implementations for QuoteSource, GameGenerator
- Silent logger for test output

**Dependencies:** Phase 6 (server integration)

**Done when:** Tests demonstrate container creation with mocks, container override pattern works, all tests pass
<!-- END_PHASE_7 -->

## Additional Considerations

**Eager initialization tradeoff:** Game services are constructed at startup. If `QUOTES_FILE_PATH` points to a missing file, the server fails immediately. This is intentional — fail fast on misconfiguration.

**Future database integration:** When adding database connections, consider whether the async datastore pattern (`Promise<DB>`) is needed. Current design defers this decision — add complexity when justified.

**OpenTelemetry exporter:** The design uses OTLP HTTP exporter. For local development without a collector, `OTEL_EXPORTER_OTLP_ENDPOINT` can be left unset (exporter will no-op). Production should configure this to point to Jaeger, Tempo, or similar.
