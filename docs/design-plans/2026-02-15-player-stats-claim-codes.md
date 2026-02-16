# Player Stats with Claim Codes

## Summary

This design adds opt-in anonymous player statistics to Unquote via a claim code system. Players who register receive a human-readable claim code (e.g., `CIPHER-TURING-7492`) that serves as both identifier and access token — no username, email, or password required. The API gains a new player domain backed by PostgreSQL (via CloudNativePG), providing endpoints for registration, session recording, and stats retrieval. The TUI introduces an onboarding flow explaining privacy and claim code mechanics, records sessions automatically after successful solves, and offers a dedicated stats screen with a solve-time graph and summary sidebar.

Implementation relies on Drizzle ORM with `node-postgres` for OpenTelemetry compatibility, uses PGlite for fast in-process integration testing, and migrates the TUI from `flag` to `cobra` for subcommand support. The claim code format (`ADJECTIVE-NOUN-NNNN`) is generated server-side using nerdy/cryptography-themed word lists. Players who don't opt in experience no change to existing behavior, and the API continues to serve puzzles normally even when the database is unavailable — stats are purely additive.

## Definition of Done

Players can opt in to anonymous stats tracking via a claim code system. The API provides endpoints for player registration, session recording, and stats retrieval, backed by PostgreSQL via CloudNativePG. The TUI offers an in-game onboarding prompt on first launch explaining what's stored and how claim codes work, records sessions after solves when opted in, and provides a dedicated stats screen with a solve-time graph and summary sidebar. CLI subcommands (`register`, `link`, `stats`, `claim-code`) are available via cobra. Players who don't opt in experience no change to existing behavior. Alternative clients can ignore the player endpoints entirely.

## Acceptance Criteria

### player-stats-claim-codes.AC1: Player Registration
- **player-stats-claim-codes.AC1.1 Success:** `POST /player` returns 201 with a claim code in `ADJECTIVE-NOUN-NNNN` format
- **player-stats-claim-codes.AC1.2 Success:** Generated claim code is unique across all players
- **player-stats-claim-codes.AC1.3 Edge:** Claim code collision triggers retry and returns a different valid code
- **player-stats-claim-codes.AC1.4 Failure:** `POST /player` returns 503 when `DATABASE_URL` is not configured

### player-stats-claim-codes.AC2: Session Recording
- **player-stats-claim-codes.AC2.1 Success:** `POST /player/:code/session` with a new game returns 201 Created
- **player-stats-claim-codes.AC2.2 Success:** `POST /player/:code/session` with a previously recorded game returns 200 OK (no-op, no data modified)
- **player-stats-claim-codes.AC2.3 Failure:** `POST /player/:code/session` with unknown claim code returns 404
- **player-stats-claim-codes.AC2.4 Failure:** `POST /player/:code/session` returns 503 when database is unavailable

### player-stats-claim-codes.AC3: Stats Retrieval
- **player-stats-claim-codes.AC3.1 Success:** `GET /player/:code/stats` returns aggregated stats including gamesPlayed, gamesSolved, winRate, currentStreak, bestStreak, bestTime, averageTime, and recentSolves
- **player-stats-claim-codes.AC3.2 Success:** `recentSolves` contains last 30 days of solve times ordered by date ascending
- **player-stats-claim-codes.AC3.3 Edge:** Stats for a player with zero solves returns zeroed counts and null for bestTime/averageTime
- **player-stats-claim-codes.AC3.4 Failure:** `GET /player/:code/stats` with unknown claim code returns 404

### player-stats-claim-codes.AC4: Streak Calculation
- **player-stats-claim-codes.AC4.1 Success:** Current streak increments for consecutive calendar days with a solve
- **player-stats-claim-codes.AC4.2 Success:** Best streak reflects the longest consecutive run in history
- **player-stats-claim-codes.AC4.3 Edge:** Streak resets to 0 when a day is missed
- **player-stats-claim-codes.AC4.4 Edge:** Multiple solves on the same day count as one streak day

### player-stats-claim-codes.AC5: Database Migration
- **player-stats-claim-codes.AC5.1 Success:** Migrations run automatically at startup with advisory lock
- **player-stats-claim-codes.AC5.2 Success:** `node dist/index.js migrate` runs migrations from CLI for init container use
- **player-stats-claim-codes.AC5.3 Edge:** Concurrent replicas starting simultaneously do not produce migration races (advisory lock serializes)
- **player-stats-claim-codes.AC5.4 Success:** API starts normally without `DATABASE_URL` (database features unavailable, puzzle serving unaffected)

### player-stats-claim-codes.AC6: TUI Onboarding
- **player-stats-claim-codes.AC6.1 Success:** First launch with no config shows onboarding form explaining what's stored and how claim codes work
- **player-stats-claim-codes.AC6.2 Success:** Opting in calls `POST /player`, saves claim code and `stats_enabled: true` to config, displays claim code
- **player-stats-claim-codes.AC6.3 Success:** Opting out saves `stats_enabled: false` to config, proceeds to puzzle
- **player-stats-claim-codes.AC6.4 Edge:** Subsequent launches with existing config skip onboarding entirely

### player-stats-claim-codes.AC7: TUI Post-Solve Recording
- **player-stats-claim-codes.AC7.1 Success:** Solving a puzzle as a registered player records the session via `POST /player/:code/session`
- **player-stats-claim-codes.AC7.2 Success:** Successfully uploaded sessions are marked `uploaded: true` in local storage
- **player-stats-claim-codes.AC7.3 Success:** Unregistered players see hint: "Tip: run 'unquote register' to track your stats" on solved screen
- **player-stats-claim-codes.AC7.4 Failure:** Recording errors are silently ignored — solve flow is never interrupted

### player-stats-claim-codes.AC8: TUI Stats Screen
- **player-stats-claim-codes.AC8.1 Success:** Stats screen shows solve-time graph (last 30 days) and summary sidebar
- **player-stats-claim-codes.AC8.2 Success:** Stats screen accessible from solved screen and via `unquote stats` subcommand
- **player-stats-claim-codes.AC8.3 Success:** Press `Esc` or `b` returns to previous screen or exits (subcommand context)

### player-stats-claim-codes.AC9: TUI Cobra CLI
- **player-stats-claim-codes.AC9.1 Success:** `unquote` (no args) plays today's puzzle, identical to current behavior
- **player-stats-claim-codes.AC9.2 Success:** `unquote register`, `unquote link <code>`, `unquote stats`, `unquote claim-code`, and `unquote version` subcommands work
- **player-stats-claim-codes.AC9.3 Success:** `--random` and `--insecure` flags work identically to current behavior

### player-stats-claim-codes.AC10: Session Reconciliation
- **player-stats-claim-codes.AC10.1 Success:** On registration, TUI backfills pre-registration solved sessions to the server
- **player-stats-claim-codes.AC10.2 Success:** On each launch (when registered), sessions without `uploaded: true` are re-submitted
- **player-stats-claim-codes.AC10.3 Success:** Server returns 200 OK for already-recorded sessions, making reconciliation idempotent
- **player-stats-claim-codes.AC10.4 Failure:** Reconciliation errors are silently ignored — app launch is never blocked

### player-stats-claim-codes.AC11: Health Endpoints
- **player-stats-claim-codes.AC11.1 Success:** `GET /health/live` always returns `200 { status: "ok" }`
- **player-stats-claim-codes.AC11.2 Success:** `GET /health/ready` returns `200` with `database: "unconfigured"` when `DATABASE_URL` is not set
- **player-stats-claim-codes.AC11.3 Success:** `GET /health/ready` returns `200` with `database: "connected"` when DB connection succeeds
- **player-stats-claim-codes.AC11.4 Success:** `GET /health/ready` returns `200` with `database: "error"` and `databaseError` detail when DB connection fails
- **player-stats-claim-codes.AC11.5 Success:** Existing `/health` endpoint removed, K8s probes updated to `/health/live` and `/health/ready`

## Glossary

- **Advisory Lock**: PostgreSQL mechanism (`pg_advisory_lock`) that prevents concurrent processes from executing the same critical section; used here to serialize migration runs across replicas
- **Branded Type**: TypeScript technique using `Tagged<T, Label>` from type-fest to create compile-time-distinct types from the same underlying primitive (e.g., `PlayerId` vs `GameSessionId` both from UUID)
- **CloudNativePG (CNPG)**: Kubernetes operator for managing PostgreSQL clusters; provides high availability and backup automation
- **Cobra**: Go CLI framework for building subcommand-based applications (e.g., `git commit`, `kubectl get`)
- **Drizzle ORM**: TypeScript ORM with schema-as-code and SQL-like query builder; generates type-safe queries and migrations
- **Drizzle Kit**: CLI tool for Drizzle that generates SQL migration files from schema changes
- **Huh**: Charmbracelet library for building interactive terminal forms in Go
- **Init Container**: Kubernetes pattern where a short-lived container runs before the main application container to perform setup tasks (e.g., running migrations)
- **Liveness Probe**: Kubernetes health check that determines if a container is running; failure triggers a restart
- **OpenTelemetry (OTEL)**: Observability framework for capturing distributed traces and metrics; auto-instrumentation libraries wrap database drivers to emit spans for every query
- **PGlite**: PostgreSQL compiled to WebAssembly for in-process use; eliminates Docker dependency in tests and runs ~2.5x faster than Testcontainers
- **Readiness Probe**: Kubernetes health check that determines if a container is ready to receive traffic; failure removes it from load balancer rotation
- **Reconciliation**: Process of syncing local state with remote state; here, the TUI re-uploads any sessions that weren't successfully recorded
- **Snapshot/Restore**: PGlite testing pattern where the database state is saved before each test and rolled back after, providing fast test isolation without recreating the schema
- **Streak**: Count of consecutive calendar days with at least one solved puzzle; resets when a day is missed
- **TypeBox**: TypeScript library for defining JSON schema with strong typing; used for request/response validation in Fastify
- **XDG Base Directory**: Unix specification for standard config/data/cache locations; `~/.config/` for user config, `~/.local/state/` for session data

## Architecture

### Overview

The system adds opt-in anonymous identity to Unquote. A player registers to receive a human-readable claim code (e.g., `CIPHER-TURING-7492`). The claim code is the player's only identity — no username, email, or password. After solving a puzzle, the TUI records the session to the server if the player is registered. Stats are derived from recorded sessions.

The claim code doubles as both identifier and access token. The threat model is minimal: the worst case is someone guessing a claim code and viewing puzzle solve times.

### Data Flow

```
First Launch (no config):
  TUI shows onboarding screen (huh form) → user opts in →
  TUI calls POST /player → API generates claim code, creates DB row →
  API returns claim code → TUI saves to XDG config

On Solve (registered player):
  TUI verifies solution via POST /game/:id/check (unchanged) →
  if correct AND stats_enabled: TUI calls POST /player/:claimCode/session →
  API records game_id, completion_time, solved_at

Stats View:
  TUI calls GET /player/:claimCode/stats →
  API queries game_sessions, returns aggregated stats + last 30 days of solve times →
  TUI renders stats screen with graph and sidebar
```

### API: Technology Choices

**ORM: Drizzle ORM** with `drizzle-orm/node-postgres` adapter. Drizzle provides strong TypeScript typing, schema-as-code, and a migration toolkit. The node-postgres (`pg`) driver is chosen over postgres.js for OTEL compatibility — `@opentelemetry/instrumentation-pg` is the official, well-maintained auto-instrumentation that captures every query as a span. Additionally, `@kubiks/otel-drizzle` can be layered on for Drizzle-semantic spans (operation type, transaction grouping).

**Migrations: drizzle-kit** generates SQL migration files in `api/packages/api/db/migrations/`. A migration runner executes at startup, guarded by a PostgreSQL advisory lock (`pg_advisory_lock(hash)`) to prevent concurrent migration races across the 3 replicas. The migration runner is also exposed as a CLI command (`node dist/index.js migrate`) for use in Kubernetes init containers.

**Testing: PGlite + mock store** (two layers):
- PlayerStore integration tests use `@electric-sql/pglite` via `drizzle-orm/pglite` — in-process PostgreSQL compiled to WASM, ~2.5x faster than Testcontainers, no Docker required. Migrations run against PGlite in `beforeAll`, with snapshot/restore per test for isolation.
- Route integration tests mock the PlayerStore at the DI level using the existing `createTestContainer` override pattern — keeps route tests fast and focused on HTTP behavior.

**Connection pooling:** 5 connections per replica × 3 replicas = 15 total connections. CNPG default `max_connections` is 100, providing ample headroom.

### API: Branded Types

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

### API: New Player Domain

New domain at `src/domain/player/` following the existing game domain pattern.

**Endpoints:**

```
POST   /player              → Create player, return claim code
GET    /player/:code/stats  → Aggregated stats + recent solve times
POST   /player/:code/session → Record a game session
```

**Route schemas** (contracts):

```typescript
// POST /player response
const CreatePlayerResponseSchema = schemaType(
  "CreatePlayerResponse",
  Type.Object({
    claimCode: Type.String({ description: "Human-readable claim code" }),
  }, { additionalProperties: false }),
);

// GET /player/:code/stats response
const PlayerStatsResponseSchema = schemaType(
  "PlayerStatsResponse",
  Type.Object({
    claimCode: Type.String(),
    gamesPlayed: Type.Integer(),
    gamesSolved: Type.Integer(),
    winRate: Type.Number({ description: "Solved / played ratio, 0-1" }),
    currentStreak: Type.Integer({ description: "Consecutive days with a solve" }),
    bestStreak: Type.Integer(),
    bestTime: Type.Union([Type.Number(), Type.Null()], {
      description: "Best completion time in milliseconds, null if no solves",
    }),
    averageTime: Type.Union([Type.Number(), Type.Null()], {
      description: "Average completion time in milliseconds, null if no solves",
    }),
    recentSolves: Type.Array(
      Type.Object({
        date: Type.String({ format: "date" }),
        completionTime: Type.Number({ description: "Milliseconds" }),
      }),
      { description: "Last 30 days of solves, ordered by date ascending" },
    ),
  }, { additionalProperties: false }),
);

// POST /player/:code/session request body
const RecordSessionRequestSchema = schemaType(
  "RecordSessionRequest",
  Type.Object({
    gameId: Type.String({ description: "Opaque game ID from puzzle response" }),
    completionTime: Type.Number({ description: "Solve time in milliseconds" }),
  }, { additionalProperties: false }),
);
```

**Claim code generation:** `ADJECTIVE-NOUN-NNNN` format using curated word lists with a nerdy/cryptography theme (e.g., `CIPHER-TURING-7492`, `QUANTUM-HOPPER-3141`, `FRACTAL-ENIGMA-2718`). ~200-300 words per list × 10000 numbers = 500M+ combinations. Word lists bundled as TypeScript arrays. Generated server-side with collision check against the database.

### API: Database Layer

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

The `unique(playerId, gameId)` constraint enforces one session per player per game. The API returns `201 Created` for new sessions and `200 OK` (no-op) for duplicate submissions, enabling simple fire-and-forget reconciliation from the client.

**DI integration:** The Drizzle instance is registered in `AppSingletonCradle` as a lazy `Promise<Drizzle | null>` via `asValue()`. If `DATABASE_URL` is not set, it resolves to `null`. A `PlayerStore` service wraps the Drizzle instance and is also registered in the singleton container. Routes access it via `request.deps.playerStore`. The PlayerStore checks for null Drizzle and returns 503 when the database is unavailable.

The PlayerStore is wrapped with `tracedProxy` for automatic OTEL span creation on every method call, following the existing pattern for `gameGenerator`.

**Migration runner:**

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

### TUI: Cobra CLI Structure

Replace `flag` package with `cobra` for subcommand support.

```
unquote                    # root command: play today's puzzle
unquote --random           # flag on root: random puzzle
unquote --insecure         # flag on root: allow HTTP
unquote register           # subcommand: opt in, get claim code
unquote link <code>        # subcommand: link existing claim code
unquote stats              # subcommand: show stats (TUI screen)
unquote claim-code         # subcommand: print claim code
unquote version            # subcommand: print version (existing)
```

### TUI: Onboarding Flow

On first launch, if no config file exists at `~/.config/unquote/config.json`, the app enters `StateOnboarding` before loading a puzzle. Uses `charmbracelet/huh` to render an interactive form explaining the stats system and asking the user to opt in.

The form shows:
- What data is stored (which puzzles solved, how long they took)
- What is NOT stored (no personal info)
- How claim codes work (random code = your identity, not a password)
- A confirm group: "Yes, track my stats" / "No thanks"

"Yes" calls `POST /player`, saves claim code and `stats_enabled: true` to config, displays the claim code with a "save this" message, then transitions to `StateLoading`.

"No thanks" saves `stats_enabled: false` to config, transitions to `StateLoading`. Never shown again.

### TUI: Config File

New `internal/config/` package, mirroring `internal/storage/` patterns but using `xdg.ConfigFile` instead of `xdg.StateFile`.

```
~/.config/unquote/config.json
```

```json
{
  "claim_code": "TIGER-MAPLE-7492",
  "stats_enabled": true
}
```

### TUI: Stats Screen

New `StateStats` accessible from the solved screen or via `unquote stats` subcommand.

Layout: graph on the left (solve times for last 30 days via `asciigraph`), summary stats on the right in a vertically-centered sidebar.

```
┌─ Solve Times (Last 30 Days) ──────────────┐  ┌─ Stats ──────────────┐
│  5:00 ┤                                    │  │                      │
│  4:00 ┤     ╭╮                             │  │  Games Played    47  │
│  3:00 ┤  ╭──╯╰─╮        ╭╮                │  │  Games Solved    45  │
│  2:00 ┤──╯     ╰────────╯╰──╮   ╭╮       │  │  Win Rate     95.7%  │
│  1:00 ┤                      ╰───╯╰──     │  │                      │
│       └────────────────────────────        │  │  Current Streak  12  │
│        Feb 1                    Feb 15     │  │  Best Streak     18  │
└────────────────────────────────────────────┘  │                      │
                                                │  Best Time     1:08  │
                                                │  Avg Time      3:24  │
                                                └──────────────────────┘
```

Press `Esc` or `b` to return. If accessed from solved screen, returns to solved screen. If accessed via `unquote stats`, exits the program.

### TUI: Post-Solve Session Recording

After a successful solve, if `stats_enabled` and `claim_code` are set in config, the TUI fires a background command (`recordSessionCmd`) that calls `POST /player/:claimCode/session`. Errors are silently ignored — stats recording is best-effort and must never interrupt gameplay.

Successfully uploaded sessions are marked with `uploaded: true` in the local session JSON (new field on `GameSession` struct).

A hint line appears on the solved screen if the player is NOT registered (no config file): `Tip: run 'unquote register' to track your stats`. Shown only when no config exists.

### TUI: Session Reconciliation

On registration, the TUI scans local session files for solved games and bulk-submits them to the server (backfill of pre-registration history). On each subsequent launch (when registered), any solved sessions without `uploaded: true` are re-submitted. The server returns `200 OK` for already-recorded sessions, making reconciliation simple fire-and-forget. Reconciliation errors are silently ignored.

### API: Health Endpoints

The existing `/health` endpoint is split into liveness and readiness probes:

- `GET /health/live` — always returns `200 { status: "ok" }`. Used by K8s liveness probe.
- `GET /health/ready` — always returns `200` but includes database status in the response body:

```json
{ "status": "ok", "database": "unconfigured" }
{ "status": "ok", "database": "connected" }
{ "status": "ok", "database": "error", "databaseError": "connection refused" }
```

Readiness always passes (200) because the primary function (puzzle serving) doesn't require the database. The DB status is informational for operators. The K8s deployment Terraform updates `livenessProbe` to `/health/live` and `readinessProbe` to `/health/ready`.

## Existing Patterns

**API domain structure:** The `game` domain at `src/domain/game/` provides the pattern — domain directory with `routes/` subdirectory containing `index.ts` aggregator, individual route files, and `schemas.ts`. The new `player` domain follows this exactly.

**DI registration:** Services are added to `AppSingletonCradle` type and registered in `configureContainer()`. The `PlayerStore` follows this pattern. Test helpers extend `TestContainerOptions` with a mock `PlayerStore`.

**Route schemas:** All schemas use `schemaType()` wrapper from `@eropple/fastify-openapi3` with `Type` from `typebox`. Response types use `Static<typeof Schema>`.

**TUI storage:** `internal/storage/` uses `xdg.StateFile()` with `os.OpenRoot()` for path traversal prevention. The new `internal/config/` package replicates this pattern with `xdg.ConfigFile()`.

**TUI commands:** `internal/app/commands.go` defines Bubble Tea `Cmd` functions for async operations. New commands (`registerPlayerCmd`, `recordSessionCmd`, `fetchStatsCmd`) follow this pattern.

**TUI states:** Model states are `State` iota constants. The view switches on `m.state`. New states (`StateOnboarding`, `StateStats`) follow this pattern.

## Implementation Phases

<!-- START_PHASE_1 -->
### Phase 1: Database Schema and Connection
**Goal:** Drizzle ORM setup, PostgreSQL connectivity, schema migrations with advisory lock

**Components:**
- Dependencies added to `api/packages/api/`: `drizzle-orm`, `pg`, `@types/pg`, `drizzle-kit` (dev), `@electric-sql/pglite` (testing), `type-fest`, `@kubiks/otel-drizzle`
- `@opentelemetry/instrumentation-pg` added to instrumentation.ts for auto-instrumented pg spans
- Drizzle schema in `src/domain/player/schema.ts` — `players` and `gameSessions` tables with branded `PlayerId` and `GameSessionId` types via `$type<>()`
- Branded type definitions in `src/domain/player/types.ts` — `PlayerId`, `GameSessionId`, `StringUUID` using `Tagged` from type-fest and TypeBox `schemaType()`
- `drizzle.config.ts` at `api/packages/api/` level, migrations output to `db/migrations/`
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
- `@kubiks/otel-drizzle` integration via `instrumentDrizzleClient()` for Drizzle-semantic spans
- Test helpers updated with mock `PlayerStore` in `tests/helpers/`
- PGlite-based integration tests for PlayerStore — verify all queries against real SQL, using snapshot/restore for test isolation

**Dependencies:** Phase 1

**Done when:** PlayerStore can create players, record sessions (201 new / 200 duplicate), retrieve stats, and generate unique claim codes. PGlite integration tests verify all operations including collision handling, the unique constraint on (player_id, game_id), streak calculation, and edge cases (no solves, single solve). Mock PlayerStore available for route tests.
<!-- END_PHASE_2 -->

<!-- START_PHASE_3 -->
### Phase 3: Player API Endpoints
**Goal:** REST endpoints for player registration, session recording, and stats

**Components:**
- Route schemas in `src/domain/player/routes/schemas.ts` using `schemaType()` and TypeBox
- `POST /player` route in `src/domain/player/routes/register.ts` — creates player, returns claim code
- `POST /player/:code/session` route in `src/domain/player/routes/session.ts` — records game session (201 Created new, 200 OK duplicate)
- `GET /player/:code/stats` route in `src/domain/player/routes/stats.ts` — returns aggregated stats and recent solves
- Route aggregator in `src/domain/player/routes/index.ts` (`registerPlayerRoutes`)
- Registration in `src/index.ts` under `/player` prefix
- Health endpoint split: `/health/live` (always 200) and `/health/ready` (200 with DB status in body) replacing existing `/health`

**Dependencies:** Phase 2

**Done when:** All three player endpoints work correctly, return proper status codes (201/200 for sessions, 404 for unknown claim code, 503 when no database). Health endpoints return correct DB status (`unconfigured`/`connected`/`error`). Integration tests using mock PlayerStore via `createTestContainer`.
<!-- END_PHASE_3 -->

<!-- START_PHASE_4 -->
### Phase 4: TUI Cobra Migration
**Goal:** Replace `flag` package with cobra for subcommand support

**Components:**
- `cobra` dependency added to `tui/go.mod`
- Root command in `tui/cmd/root.go` — replaces `main.go` flag parsing, runs the game
- `version` subcommand in `tui/cmd/version.go`
- `main.go` simplified to call `cmd.Execute()`
- Existing flags (`--random`, `--insecure`) migrated to cobra persistent/local flags

**Dependencies:** None (parallel with API phases)

**Done when:** `unquote`, `unquote --random`, `unquote --insecure`, and `unquote version` all work identically to current behavior. Build and tests pass.
<!-- END_PHASE_4 -->

<!-- START_PHASE_5 -->
### Phase 5: TUI Config and Player API Client
**Goal:** XDG config file support and API client methods for player endpoints

**Components:**
- `internal/config/` package — load/save config from `~/.config/unquote/config.json` using `xdg.ConfigFile()`
- New API client methods in `internal/api/client.go` — `RegisterPlayer()`, `RecordSession()`, `FetchStats()`
- Response types in `internal/api/types.go` for player endpoints

**Dependencies:** Phase 4 (cobra structure), Phase 3 (API endpoints exist)

**Done when:** Config loads/saves correctly, API client methods work against the player endpoints. Tests verify config persistence and API client behavior.
<!-- END_PHASE_5 -->

<!-- START_PHASE_6 -->
### Phase 6: TUI Onboarding Flow
**Goal:** First-launch interactive onboarding with huh form

**Components:**
- `charmbracelet/huh` dependency added to `tui/go.mod`
- `StateOnboarding` state added to model
- Onboarding view using huh form — privacy explanation and opt-in prompt
- Claim code display after registration
- Transition to `StateLoading` after onboarding completes
- `register` and `link` subcommands in `tui/cmd/`
- `claim-code` subcommand in `tui/cmd/`

**Dependencies:** Phase 5

**Done when:** First launch shows onboarding when no config exists, "Yes" registers and saves claim code, "No" saves opt-out. Subcommands work for registration, linking, and displaying claim code. Subsequent launches skip onboarding.
<!-- END_PHASE_6 -->

<!-- START_PHASE_7 -->
### Phase 7: Post-Solve Session Recording
**Goal:** Automatic session recording after successful solves

**Components:**
- `recordSessionCmd` in `internal/app/commands.go` — calls `POST /player/:code/session`
- Integration in `handleSolutionChecked()` in `update.go` — fires `recordSessionCmd` after successful solve when registered
- Hint message on solved screen when not registered: "Tip: run 'unquote register' to track your stats"

**Dependencies:** Phase 6

**Done when:** Solving a puzzle as a registered player records the session server-side. Errors in recording don't affect the solve flow. Unregistered players see the hint.
<!-- END_PHASE_7 -->

<!-- START_PHASE_8 -->
### Phase 8: Stats Screen
**Goal:** In-game stats visualization with graph and summary

**Components:**
- `asciigraph` dependency added to `tui/go.mod`
- `StateStats` state added to model
- `fetchStatsCmd` in `commands.go` — calls `GET /player/:code/stats`
- Stats view with asciigraph line chart (last 30 days solve times) and Lip Gloss sidebar (summary stats)
- Navigation: accessible from solved screen via button/key, or via `unquote stats` subcommand
- `stats` subcommand in `tui/cmd/`

**Dependencies:** Phase 7

**Done when:** Stats screen renders correctly with graph and sidebar, data loads from API, navigation works from both solved screen and CLI subcommand.
<!-- END_PHASE_8 -->

## Additional Considerations

**Claim code security:** Claim codes are intentionally not secrets. Rate limiting on the player endpoints (already provided by the global rate limiter) prevents brute-force enumeration. No additional auth is needed given the threat model (puzzle stats are not sensitive).

**Migration deployment:** Migrations auto-run at startup with advisory lock for safe concurrent execution across replicas. The `node dist/index.js migrate` CLI command enables a Kubernetes init container pattern for environments where auto-migration at startup is undesirable. Both paths use the same advisory-locked runner.

**Offline/degraded mode:** If the player API is unreachable (network error, 503), the TUI silently skips session recording and stats display. The core puzzle experience is never affected by player feature availability.

**Terraform changes required:** The K8s deployment in `home.coderinserepeat.com/terraform/unquote/` needs a `DATABASE_URL` env var pointing to the CNPG cluster. A CNPG `Cluster` resource is also needed (separate Terraform or manual setup). These are infra concerns outside the scope of this design but required for deployment.
