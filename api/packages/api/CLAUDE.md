# API Server

Last verified: 2026-02-16

## Purpose

REST API server for the Unquote cryptoquip game. Serves puzzle endpoints, validates solutions, and tracks player statistics.

## Contracts

- **Exposes**: REST endpoints under `/game` and `/health` prefixes, OpenAPI documentation
- **Guarantees**: Deterministic puzzles by date, type-safe request/response handling
- **Expects**: `QUOTES_FILE_PATH` environment variable pointing to quotes JSON file. Optionally `DATABASE_URL` for player stats (gracefully degrades without it).

## Dependencies

- **Uses**: Fastify 5, TypeBox, Awilix, `@unquote/game-generator`, Luxon, Sqids, Drizzle ORM, node-postgres, type-fest
- **Used by**: TUI client, future web client
- **Boundary**: HTTP layer and persistence; puzzle logic delegated to game-generator package

## Key Decisions

- TypeBox for schemas: Import from `"typebox"` (TypeBox 1.0), not `"@sinclair/typebox"`
- Awilix for DI: Singleton container for services, request scope for logger
- Domain routes: Business routes under `src/domain/<domain>/routes/`; infra routes under `src/routes/`
- Luxon for dates: All date handling uses Luxon DateTime, not JS Date
- Branded UUIDs: Domain IDs use `Tagged<StringUUID, "tag">` from type-fest to prevent mixing PlayerId and GameSessionId
- CLI entrypoint: `node dist/index.js migrate` runs database migrations and exits (for init containers)

## Development Tools

- **LSP**: Use TypeScript LSP operations (goToDefinition, findReferences, hover, documentSymbol) when making code changes to ensure type-aware edits with accurate line numbers
- **Testing**: Use `createTestContainer()` from `tests/helpers/` with mock defaults; override specific dependencies as needed. For database integration tests, use PGlite snapshot/restore from `tests/helpers/pglite.ts`.

## Anti-Patterns (Do NOT Add)

- Functional Core/Imperative Shell comments - the pattern is implicit, do not document in code
- `@sinclair/typebox` imports - use `"typebox"` instead
- JS Date objects - use Luxon DateTime for all date handling
- Cross-package filesystem references - use shared resources directory

## Shared Resources

Test data and fixtures shared across packages live in `api/resources/`:

- `api/resources/quotes.json` - Quote data for testing and development

Both `@unquote/api` and `@unquote/game-generator` tests can reference this location.

## Docker / Podman

- Fastify binds `0.0.0.0` (IPv4 only). Podman's `-p 3000:3000` maps IPv4 by default, so `curl localhost` may fail on systems where it resolves to `::1` (IPv6). Use `curl -4 http://localhost:3000` or `curl http://127.0.0.1:3000` when testing locally.

## Key Files

- `src/index.ts` - Server entry point, plugin registration
- `src/domain/game/routes/` - Game endpoints (puzzle retrieval, solution checking)
- `src/domain/game/game-id.ts` - Sqids-based date encoding for opaque game IDs
- `src/routes/health.ts` - Health check endpoint (no DI dependencies)
- `src/sources/` - Data source implementations (JsonQuoteSource, StaticKeywordSource)
- `src/tracing/` - Tracing utilities (`tracedProxy` for DI service instrumentation)
- `src/deps/` - Awilix dependency injection configuration
- `src/config/` - Environment variable schema and validation
- `src/domain/player/` - Player stats domain (store, schema, types, migrator, claim codes)
- `db/migrations/` - Drizzle SQL migration files (shipped in production image)
- `drizzle.config.ts` - Drizzle Kit configuration for migration generation
- `tests/helpers/` - Test utilities including DI container factory and PGlite helpers
