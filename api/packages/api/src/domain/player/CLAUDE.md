# Player Domain

Last verified: 2026-02-16

## Purpose

Manages player identity, game session recording, and statistics aggregation. Players are identified by claim codes (anonymous, human-readable identifiers). All persistence goes through PostgreSQL via Drizzle ORM.

## Contracts

- **Exposes**: `PlayerStore` interface (create player, record session, get stats, check health), `PgPlayerStore` implementation, `runMigrationsWithLock()`, `runMigrateCli()`, branded types (`PlayerId`, `GameSessionId`), `DatabaseUnavailableError`, `PlayerNotFoundError`
- **Guarantees**: Claim codes are unique (retries on collision up to 5 times). Session recording is idempotent (unique constraint on player+game). Migrations use `pg_advisory_lock(42)` to prevent races across replicas. Stats aggregation includes streaks, win rate, best/average times, and recent solves (30 days).
- **Expects**: A configured `NodePgDatabase` (Drizzle) instance. The module does not manage its own database connection; that is handled by the DI container in `src/deps/singleton.ts`.

## Dependencies

- **Uses**: Drizzle ORM (query builder + migrations), Luxon (streak date calculations), type-fest (branded UUID types), TypeBox (schema definitions)
- **Used by**: DI container (`src/deps/singleton.ts`)
- **Boundary**: Data access, domain logic, and HTTP route handlers. Routes in `routes/` follow the same domain route pattern as `src/domain/game/routes/`.

## Key Decisions

- Claim codes over passwords: Players use `ADJECTIVE-NOUN-NNNN` codes (e.g., `CIPHER-TURING-7492`) for anonymous identity without authentication complexity
- Branded UUIDs: `PlayerId` and `GameSessionId` are `Tagged<StringUUID, tag>` to prevent accidental interchange at the type level
- Advisory lock for migrations: `pg_advisory_lock(42)` is session-scoped, auto-releases on crash
- PGlite for integration tests: Uses `@electric-sql/pglite` with snapshot/restore for fast, isolated test runs without external PostgreSQL

## Invariants

- One game session per player per game (enforced by unique constraint on `player_id + game_id`)
- Claim codes are unique across all players (enforced by unique constraint)
- All timestamps use `timestamptz` (with timezone) in PostgreSQL
- Streak calculation requires solve dates sorted ascending with no duplicates

## Key Files

- `types.ts` - PlayerStore interface, branded ID types, error classes
- `store.ts` - `PgPlayerStore` implementation with Drizzle queries
- `schema.ts` - Drizzle table definitions (`players`, `game_sessions`)
- `migrator.ts` - Migration runner with advisory lock + CLI entrypoint
- `claim-code.ts` - Claim code generator with themed word lists
- `store.test.integration.ts` - PGlite-based integration tests
- `routes/index.ts` - Aggregator plugin registering all player sub-routes
- `routes/schemas.ts` - TypeBox request/response schemas for player endpoints
- `routes/register.ts` - POST /player (player registration)
- `routes/session.ts` - POST /player/:code/session (session recording)
- `routes/stats.ts` - GET /player/:code/stats (statistics retrieval)
