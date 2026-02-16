# Dependency Injection

Last verified: 2026-02-16

## Purpose

Manages application dependencies with lifetime-aware scoping. Singleton services (config, quote source, keyword source, game generator, player store) live for app lifetime; request-scoped services (logger with trace context) live per-request.

## Contracts

- **Exposes**: `configureContainer()` (async, returns `{ container, shutdown }`), `configureRequestScope()`, `registerDependencyInjection` plugin, `AppSingletonCradle`, `AppRequestCradle` types
- **Guarantees**: Fastify type extensions make `fastify.deps` and `request.deps` typed. Request scopes are created in `onRequest` and disposed in `onResponse`. Quote source is eagerly loaded and validated at startup (fail-fast). DI services (`quoteSource`, `keywordSource`, `playerStore`) are wrapped with `tracedProxy` for automatic OpenTelemetry span creation on method calls. Database pool is gracefully shut down via the `shutdown` callback on server close. `playerStore` is `null` when `DATABASE_URL` is not configured.
- **Expects**: Valid `AppConfig` and Pino logger at container creation. Plugin registered after `@fastify/env`.

## Dependencies

- **Uses**: Awilix, `@unquote/game-generator` (QuoteSource, KeywordSource, GameGenerator), local `sources/` module (JsonQuoteSource, StaticKeywordSource), local `tracing/` module (tracedProxy), local `domain/player/` module (PgPlayerStore, PlayerStore, migrator), Drizzle ORM, node-postgres, `@kubiks/otel-drizzle`, config module
- **Used by**: All route handlers (via `request.deps`), server startup
- **Boundary**: Do NOT import Fastify request/reply types here; this is framework-agnostic DI

## Key Decisions

- Awilix over tsyringe: Better ESM support, explicit container configuration
- Request scope overrides logger only: Other dependencies are immutable per-request
- Type extensions in separate files: Keeps FastifyInstance/FastifyRequest augmentation isolated
- Database pool and Drizzle instance are local to `configureContainer`, not registered in the cradle; only the `PlayerStore` interface is exposed
- `configureContainer` returns a `{ container, shutdown }` tuple so the DI plugin can register pool cleanup on server close

## Invariants

- Singleton container created exactly once at startup
- Request scopes always disposed after response (prevents memory leaks)
- Container runs in strict mode (missing dependencies throw at resolution time)
- `playerStore` is `null` (not absent) when database is not configured; consumers must null-check
- Database migrations run automatically at startup when `DATABASE_URL` is set (with advisory lock)

## Key Files

- `singleton.ts` - Singleton container with app-lifetime services
- `request.ts` - Request-scoped container factory
- `plugin.ts` - Fastify plugin that wires DI lifecycle
- `type-extensions.ts` - TypeScript module augmentation for Fastify
- `index.ts` - Public exports
