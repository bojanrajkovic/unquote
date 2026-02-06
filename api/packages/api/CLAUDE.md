# API Server

Last verified: 2026-02-05

## Purpose

REST API server for the Unquote cryptoquip game. Serves puzzle endpoints and validates solutions.

## Contracts

- **Exposes**: REST endpoints under `/game` and `/health` prefixes, OpenAPI documentation
- **Guarantees**: Deterministic puzzles by date, type-safe request/response handling
- **Expects**: `QUOTES_FILE_PATH` environment variable pointing to quotes JSON file

## Dependencies

- **Uses**: Fastify 5, TypeBox, Awilix, `@unquote/game-generator`, Luxon, Sqids
- **Used by**: TUI client, future web client
- **Boundary**: HTTP layer only; business logic delegated to game-generator package

## Key Decisions

- TypeBox for schemas: Import from `"typebox"` (TypeBox 1.0), not `"@sinclair/typebox"`
- Awilix for DI: Singleton container for services, request scope for logger
- Concentric pattern: Routes organized under `src/domain/<domain>/routes/`
- Luxon for dates: All date handling uses Luxon DateTime, not JS Date

## Development Tools

- **LSP**: Use TypeScript LSP operations (goToDefinition, findReferences, hover, documentSymbol) when making code changes to ensure type-aware edits with accurate line numbers
- **Testing**: Use `createTestContainer()` from `tests/helpers/` with mock defaults; override specific dependencies as needed

## Anti-Patterns (Do NOT Add)

- Functional Core/Imperative Shell comments - the pattern is implicit, do not document in code
- `@sinclair/typebox` imports - use `"typebox"` instead
- JS Date objects - use Luxon DateTime for all date handling
- Cross-package filesystem references - use shared resources directory

## Shared Resources

Test data and fixtures shared across packages live in `api/resources/`:

- `api/resources/quotes.json` - Quote data for testing and development

Both `@unquote/api` and `@unquote/game-generator` tests can reference this location.

## Key Files

- `src/index.ts` - Server entry point, plugin registration
- `src/domain/game/routes/` - Game endpoints (puzzle retrieval, solution checking)
- `src/domain/game/game-id.ts` - Sqids-based date encoding for opaque game IDs
- `src/domain/health/` - Health check endpoint (no DI dependencies)
- `src/deps/` - Awilix dependency injection configuration
- `src/config/` - Environment variable schema and validation
- `tests/helpers/` - Test utilities including DI container factory
