# Player Stats: Database Layer

## Summary

This design introduces PostgreSQL-backed player statistics to the Unquote API using Drizzle ORM with node-postgres. The implementation establishes a `players` table to store claim codes (human-readable identifiers in `ADJECTIVE-NOUN-NNNN` format) and a `game_sessions` table to track solve times with a uniqueness constraint on player-game pairs. The PlayerStore service provides the data access layer, exposing operations to create players, record completed games (with duplicate detection), and aggregate stats including streaks, averages, and recent solve history.

The approach maintains the API's existing graceful degradation pattern — when `DATABASE_URL` is absent, the database features remain unavailable but puzzle serving continues unaffected. Drizzle schema definitions with branded UUID types enforce compile-time type safety for player and session identifiers. Migrations run automatically at startup using PostgreSQL advisory locks to prevent races across the three replicas, with an additional CLI entrypoint for Kubernetes init container use. OpenTelemetry instrumentation captures both pg driver queries and Drizzle-semantic operations. Testing employs PGlite (in-process WASM PostgreSQL) for fast, Docker-free integration tests of the store layer, while API route tests use mocked stores via the existing dependency injection override pattern.

## Definition of Done

PostgreSQL connectivity is established via Drizzle ORM with `node-postgres`. Database schema defines `players` and `game_sessions` tables with branded `PlayerId` and `GameSessionId` types. Migrations run automatically at startup with advisory lock and via `node dist/index.js migrate` CLI command. PlayerStore provides CRUD operations for players and sessions, stats aggregation queries (streaks, averages, recent solves), and claim code generation with collision retry. PGlite integration tests verify all store operations. API starts normally without `DATABASE_URL` (database features unavailable, puzzle serving unaffected). Mock PlayerStore is available for downstream route testing.

## Acceptance Criteria

### player-stats-database.AC1: Database Migration
- **player-stats-database.AC1.1 Success:** Migrations run automatically at startup with advisory lock
- **player-stats-database.AC1.2 Success:** `node dist/index.js migrate` runs migrations from CLI for init container use
- **player-stats-database.AC1.3 Edge:** Concurrent replicas starting simultaneously do not produce migration races (advisory lock serializes)
- **player-stats-database.AC1.4 Success:** API starts normally without `DATABASE_URL` (database features unavailable, puzzle serving unaffected)

### player-stats-database.AC2: Player Creation and Claim Codes
- **player-stats-database.AC2.1 Success:** `createPlayer()` returns a claim code in `ADJECTIVE-NOUN-NNNN` format
- **player-stats-database.AC2.2 Success:** Generated claim code is unique across all players
- **player-stats-database.AC2.3 Edge:** Claim code collision triggers retry and returns a different valid code
- **player-stats-database.AC2.4 Failure:** `createPlayer()` throws `DatabaseUnavailableError` when Drizzle instance is null (database unconfigured)

### player-stats-database.AC3: Session Recording
- **player-stats-database.AC3.1 Success:** `recordSession()` with a new game returns `"created"`
- **player-stats-database.AC3.2 Success:** `recordSession()` with a previously recorded game returns `"exists"` (no data modified)
- **player-stats-database.AC3.3 Failure:** `recordSession()` with unknown claim code throws a domain error (player not found); the API layer catches this and returns 404
- **player-stats-database.AC3.4 Failure:** `recordSession()` throws `DatabaseUnavailableError` when Drizzle instance is null (database unconfigured)

### player-stats-database.AC4: Stats Aggregation
- **player-stats-database.AC4.1 Success:** `getStats()` returns gamesPlayed, gamesSolved, winRate, currentStreak, bestStreak, bestTime, averageTime, and recentSolves
- **player-stats-database.AC4.2 Success:** `recentSolves` contains last 30 days of solve times ordered by date ascending
- **player-stats-database.AC4.3 Edge:** Stats for a player with zero solves returns zeroed counts and null for bestTime/averageTime
- **player-stats-database.AC4.4 Failure:** `getStats()` with unknown claim code returns `null`
- **player-stats-database.AC4.5 Failure:** `getStats()` throws `DatabaseUnavailableError` when Drizzle instance is null (database unconfigured)

### player-stats-database.AC6: Health Check
- **player-stats-database.AC6.1 Success:** `checkHealth()` returns `{ status: "connected" }` when database connection succeeds
- **player-stats-database.AC6.2 Failure:** `checkHealth()` returns `{ status: "error", error: "<message>" }` when database connection fails

### player-stats-database.AC7: Streak Calculation
- **player-stats-database.AC7.1 Success:** Current streak increments for consecutive calendar days with a solve
- **player-stats-database.AC7.2 Success:** Best streak reflects the longest consecutive run in history
- **player-stats-database.AC7.3 Edge:** Streak resets to 0 when a day is missed
- **player-stats-database.AC7.4 Edge:** Multiple solves on the same day count as one streak day

Note: Streak calculation uses UTC dates (derived from `solved_at` timestamp with timezone).

## Glossary

- **Advisory Lock**: PostgreSQL session-scoped lock (`pg_advisory_lock`) used to serialize migration execution across concurrent API replicas without external coordination
- **Branded Type**: TypeScript pattern using nominal typing (via `type-fest` `Tagged`) to make structurally identical types (like two UUID strings) incompatible at compile time
- **Claim Code**: Human-readable player identifier in `ADJECTIVE-NOUN-NNNN` format (e.g., `CIPHER-TURING-7492`) generated server-side with uniqueness guarantees
- **CloudNativePG (CNPG)**: Kubernetes operator managing PostgreSQL clusters with high availability and backup features
- **Drizzle Kit**: CLI tool that generates SQL migration files from Drizzle schema definitions
- **Drizzle ORM**: TypeScript-first database toolkit providing type-safe query building, schema-as-code, and migration generation without decorators or code generation steps
- **node-postgres (pg)**: Node.js PostgreSQL driver chosen for compatibility with official OpenTelemetry auto-instrumentation
- **OpenTelemetry (OTEL)**: Observability framework for capturing distributed traces and metrics; auto-instrumentation libraries wrap database drivers to emit spans for every query
- **PGlite**: In-process PostgreSQL compiled to WebAssembly, enabling fast integration tests without Docker or external database instances
- **Snapshot/Restore**: PGlite testing pattern where the database state is saved before each test and rolled back after, providing fast test isolation without recreating the schema
- **Streak**: Count of consecutive calendar days with at least one solved puzzle; resets when a day is missed
- **tracedProxy**: Existing codebase pattern that wraps service instances to automatically create OpenTelemetry spans for every method call
- **TypeBox**: TypeScript library for defining JSON schema with strong typing; used for request/response validation in Fastify

## Architecture

### Technology Choices

**ORM: Drizzle ORM** with `drizzle-orm/node-postgres` adapter. Drizzle provides strong TypeScript typing, schema-as-code, and a migration toolkit. The node-postgres (`pg`) driver is chosen over postgres.js for OTEL compatibility — `@opentelemetry/instrumentation-pg` is the official, well-maintained auto-instrumentation that captures every query as a span. Additionally, `@kubiks/otel-drizzle` can be layered on for Drizzle-semantic spans (operation type, transaction grouping).

**Migrations: drizzle-kit** generates SQL migration files in `api/packages/api/db/migrations/`. A migration runner executes at startup, guarded by a PostgreSQL advisory lock (`pg_advisory_lock(hash)`) to prevent concurrent migration races across the 3 replicas. The migration runner is also exposed as a CLI command (`node dist/index.js migrate`) for use in Kubernetes init containers.

**Testing: PGlite + mock store** (two layers):
- PlayerStore integration tests use `@electric-sql/pglite` via `drizzle-orm/pglite` — in-process PostgreSQL compiled to WASM, ~2.5x faster than Testcontainers, no Docker required. Migrations run against PGlite in `beforeAll`, with snapshot/restore per test for isolation.
- Route integration tests (in the API design plan) mock the PlayerStore at the DI level using the existing `createTestContainer` override pattern — keeps route tests fast and focused on HTTP behavior.

**Connection pooling:** 5 connections per replica × 3 replicas = 15 total connections. CNPG default `max_connections` is 100, providing ample headroom.

### Branded Types

Player IDs use branded UUIDs via TypeBox and Drizzle's `$type<>`, following the pattern from the concentric reference codebase. This provides compile-time safety without the full rich ID prefix layer (claim codes already serve as the human-facing identifier).

```typescript
import { Tagged } from "type-fest";

// Base branded UUID type
export type StringUUID = ReturnType<typeof randomUUID>;
export const StringUUIDSchema = schemaType(
  "StringUUID",
  Type.Unsafe<StringUUID>({
    ...Type.String({ format: "uuid" }),
  })
);

// Domain-specific branded ID
export type PlayerId = Tagged<StringUUID, "playerId">;
export const PlayerIdSchema = schemaType(
  "PlayerId",
  Type.Unsafe<PlayerId>({
    ...Type.String({ format: "uuid" }),
  })
);

export type GameSessionId = Tagged<StringUUID, "gameSessionId">;
```

On Drizzle columns: `id: uuid().primaryKey().defaultRandom().$type<PlayerId>()`. This ensures a `PlayerId` cannot be accidentally passed where a `GameSessionId` is expected.

### Database Schema

**Drizzle schema** (defines tables, generates migrations):

```typescript
import { pgTable, uuid, text, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const players = pgTable("players", {
  id: uuid().primaryKey().defaultRandom().$type<PlayerId>(),
  claimCode: text("claim_code").unique().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gameSessions = pgTable("game_sessions", {
  id: uuid().primaryKey().defaultRandom().$type<GameSessionId>(),
  playerId: uuid("player_id").notNull().references(() => players.id).$type<PlayerId>(),
  gameId: text("game_id").notNull(),
  completionTime: integer("completion_time").notNull(),
  solvedAt: timestamp("solved_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique().on(table.playerId, table.gameId),
]);
```

The `unique(playerId, gameId)` constraint enforces one session per player per game. The PlayerStore returns distinct results for new vs duplicate submissions, enabling simple fire-and-forget reconciliation from clients.

**Indexes:** `players.claim_code` is implicitly indexed via the unique constraint. Consider adding an index on `game_sessions.solved_at` for date-range queries in streak calculation and recent solves.

Duplicate session detection uses Drizzle's `onConflictDoNothing()` on the `(playerId, gameId)` unique constraint, returning `'exists'` when no row is inserted.

### DI Integration

The Drizzle instance is registered in `AppSingletonCradle` as a lazy `Promise<Drizzle | null>` via `asValue()`. If `DATABASE_URL` is not set, it resolves to `null`. A `PlayerStore` service wraps the Drizzle instance and is also registered in the singleton container. Routes access it via `request.deps.playerStore`. All PlayerStore methods throw a `DatabaseUnavailableError` when the Drizzle instance is `null`. The API layer catches this error and returns 503 Service Unavailable.

The PlayerStore is wrapped with `tracedProxy` for automatic OTEL span creation on every method call, following the existing pattern for `gameGenerator`.

### Migration Runner

```typescript
async function runMigrationsWithLock(db: Drizzle) {
  await db.execute(sql`SELECT pg_advisory_lock(42)`);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(42)`);
  }
}
```

The advisory lock (magic number `42`, arbitrary but consistent) ensures only one replica runs migrations at a time. The lock is session-scoped and auto-releases if the pod crashes mid-migration. Also exposed as a CLI entrypoint (`node dist/index.js migrate`) for Kubernetes init container use.

### Claim Code Generation

`ADJECTIVE-NOUN-NNNN` format using curated word lists with a nerdy/cryptography theme (e.g., `CIPHER-TURING-7492`, `QUANTUM-HOPPER-3141`, `FRACTAL-ENIGMA-2718`). ~200-300 words per list × 10000 numbers = 500M+ combinations. Word lists bundled as TypeScript arrays. Generated server-side with collision check against the database and retry loop.

Word lists are hardcoded TypeScript arrays in `claim-code.ts`. Adding or removing words is a code change requiring a new deployment.

### PlayerStore Contract

The PlayerStore exposes these operations to downstream consumers (API routes):

```typescript
interface PlayerStats {
  gamesPlayed: number;
  gamesSolved: number;
  winRate: number; // 0-1
  currentStreak: number;
  bestStreak: number;
  bestTime: number | null;
  averageTime: number | null;
  recentSolves: Array<{ date: string; completionTime: number }>;
}

interface PlayerStore {
  createPlayer(): Promise<{ claimCode: string }>;
  recordSession(claimCode: string, gameId: string, completionTime: number): Promise<"created" | "exists">;
  getStats(claimCode: string): Promise<PlayerStats | null>;
  checkHealth(): Promise<{ status: "connected" | "error"; error?: string }>;
}
```

`recordSession` returns `"created"` for new sessions and `"exists"` for duplicates (unique constraint on `player_id, game_id`). `getStats` returns `null` for unknown claim codes. Stats include `gamesPlayed`, `gamesSolved`, `winRate`, `currentStreak`, `bestStreak`, `bestTime`, `averageTime`, and `recentSolves` (last 30 days).

Note: when the Drizzle instance is `null` (database not configured), the health status `"unconfigured"` is handled at the DI level — `checkHealth()` is only called when a Drizzle instance is present.

## Existing Patterns

**API domain structure:** The `game` domain at `src/domain/game/` provides the pattern — domain directory with `routes/` subdirectory containing `index.ts` aggregator, individual route files, and `schemas.ts`. The new `player` domain follows this exactly, with schema and store files at the domain root.

**DI registration:** Services are added to `AppSingletonCradle` type and registered in `configureContainer()`. The `PlayerStore` follows this pattern. Test helpers extend `TestContainerOptions` with a mock `PlayerStore`.

**Traced proxy:** `tracedProxy` wraps service instances for automatic OTEL span creation, as used for `gameGenerator`. The `PlayerStore` follows this pattern.

## Implementation Phases

<!-- START_PHASE_1 -->
### Phase 1: Database Schema and Connection
**Goal:** Drizzle ORM setup, PostgreSQL connectivity, schema migrations with advisory lock

**Components:**
- Dependencies added to `api/packages/api/`: `drizzle-orm`, `pg`, `@types/pg`, `drizzle-kit` (dev), `@electric-sql/pglite` (testing), `type-fest`, `@kubiks/otel-drizzle`
- `@opentelemetry/instrumentation-pg` added to the `instrumentations` array in `instrumentation.ts` for auto-instrumented pg spans
- Drizzle schema in `src/domain/player/schema.ts` — `players` and `gameSessions` tables with branded `PlayerId` and `GameSessionId` types via `$type<>()`
- Branded type definitions in `src/domain/player/types.ts` — `PlayerId`, `GameSessionId`, `StringUUID` using `Tagged` from type-fest and TypeBox `schemaType()`
- `drizzle.config.ts` at `api/packages/api/` level, migrations output to `db/migrations/`; drizzle-kit generates timestamped migration files (e.g., `0000_migration_name.sql`) in `db/migrations/`
- `DATABASE_URL` added as optional env var to config schema in `src/config/schema.ts`
- Connection pool setup in `src/deps/singleton.ts` — registered as `asValue(Promise<Drizzle | null>)`, resolves to `null` when `DATABASE_URL` is not set
- Migration runner with `pg_advisory_lock(42)` in `src/domain/player/migrator.ts`
- CLI migration entrypoint: `node dist/index.js migrate`

**Dependencies:** None

**Done when:** API connects to PostgreSQL when `DATABASE_URL` is set, migrations run with advisory lock, tables are created, API still starts normally without `DATABASE_URL`. PGlite test setup verified with migration files.
<!-- END_PHASE_1 -->

<!-- START_PHASE_2 -->
### Phase 2: Player Store and Claim Code Generation
**Goal:** Data access layer for players and sessions, claim code generation, OTEL tracing

**Components:**
- `PlayerStore` service in `src/domain/player/store.ts` — CRUD operations for players and sessions, stats aggregation queries (streak calculation, averages, recent solves)
- Claim code generator in `src/domain/player/claim-code.ts` — `ADJECTIVE-NOUN-NNNN` format with nerdy/crypto-themed word lists bundled as TypeScript arrays, collision retry loop
- `PlayerStore` registered in `AppSingletonCradle` and DI container, wrapped with `tracedProxy` for automatic OTEL spans
- `@kubiks/otel-drizzle` integration via `instrumentDrizzleClient()` wrapping the Drizzle instance during creation in `singleton.ts`, adding Drizzle-semantic spans (operation type, table name)
- Mock PlayerStore in `tests/helpers/` returns: `createPlayer()` → fixed claim code `TEST-CODE-0000`, `recordSession()` → `"created"`, `getStats()` → fixture data with representative values, `checkHealth()` → `{ status: "connected" }`
- PGlite-based integration tests for PlayerStore — verify all queries against real SQL, using snapshot/restore for test isolation

**Dependencies:** Phase 1

**Done when:** PlayerStore can create players, record sessions (created vs exists), retrieve stats, and generate unique claim codes. PGlite integration tests verify all operations including collision handling, the unique constraint on (player_id, game_id), streak calculation, and edge cases (no solves, single solve). Mock PlayerStore available for route tests.
<!-- END_PHASE_2 -->

## Additional Considerations

**Migration deployment:** Migrations auto-run at startup with advisory lock for safe concurrent execution across replicas. The `node dist/index.js migrate` CLI command enables a Kubernetes init container pattern for environments where auto-migration at startup is undesirable. Both paths use the same advisory-locked runner.

**Terraform changes required:** The K8s deployment in `home.coderinserepeat.com/terraform/unquote/` needs a `DATABASE_URL` env var pointing to the CNPG cluster. A CNPG `Cluster` resource is also needed (separate Terraform or manual setup). These are infra concerns outside the scope of this design but required for deployment.

**Connection pool shutdown:** The pg pool should be closed gracefully on SIGTERM, alongside the existing OpenTelemetry SDK shutdown in `instrumentation.ts`.

**Migration rollback:** This design uses forward-only migrations. Drizzle Kit does not generate down migrations by default. If a migration needs to be reversed, a new forward migration should be written.
