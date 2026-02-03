# Dependency Injection

Last verified: 2026-02-03

## Purpose

Manages application dependencies with lifetime-aware scoping. Singleton services (config, game generator) live for app lifetime; request-scoped services (logger with trace context) live per-request.

## Contracts

- **Exposes**: `configureContainer()`, `configureRequestScope()`, `registerDependencyInjection` plugin, `AppSingletonCradle`, `AppRequestCradle` types
- **Guarantees**: Fastify type extensions make `fastify.deps` and `request.deps` typed. Request scopes are created in `onRequest` and disposed in `onResponse`.
- **Expects**: Valid `AppConfig` and Pino logger at container creation. Plugin registered after `@fastify/env`.

## Dependencies

- **Uses**: Awilix, `@unquote/game-generator` (QuoteSource, GameGenerator), config module
- **Used by**: All route handlers (via `request.deps`), server startup
- **Boundary**: Do NOT import Fastify request/reply types here; this is framework-agnostic DI

## Key Decisions

- Awilix over tsyringe: Better ESM support, explicit container configuration
- Request scope overrides logger only: Other dependencies are immutable per-request
- Type extensions in separate files: Keeps FastifyInstance/FastifyRequest augmentation isolated

## Invariants

- Singleton container created exactly once at startup
- Request scopes always disposed after response (prevents memory leaks)
- Container runs in strict mode (missing dependencies throw at resolution time)

## Key Files

- `singleton.ts` - Singleton container with app-lifetime services
- `request.ts` - Request-scoped container factory
- `plugin.ts` - Fastify plugin that wires DI lifecycle
- `type-extensions.ts` - TypeScript module augmentation for Fastify
- `index.ts` - Public exports
