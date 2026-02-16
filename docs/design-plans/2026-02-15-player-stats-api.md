# Player Stats: API Endpoints

## Summary

This design adds optional player identity and statistics to the Unquote puzzle API. Players register anonymously to receive a human-readable claim code (e.g., `CIPHER-TURING-7492`) which serves as both identifier and access credential. After completing a puzzle, clients can optionally record the session to track solve times, win streaks, and personal bests. No email, username, or password is required — the claim code is the player's only identity.

The implementation follows the existing `game` domain pattern: new routes under `src/domain/player/routes/` with TypeBox schemas for registration, session recording, and stats retrieval. All endpoints integrate with a PlayerStore service (provided by the companion [database layer design](2026-02-15-player-stats-database.md)) via the Awilix DI container. The existing `/health` endpoint is split into liveness (`/health/live`) and readiness (`/health/ready`) probes, with readiness reporting database connectivity status in the response body while always returning 200 OK since puzzle serving (the primary API function) doesn't require the database.

## Definition of Done

REST endpoints for player registration (`POST /player`), session recording (`POST /player/:code/session`), and stats retrieval (`GET /player/:code/stats`) are implemented and tested. Registration returns a claim code; session recording returns 201 for new sessions and 200 for duplicates; stats returns aggregated data including streaks, averages, and recent solves. Unknown claim codes return 404; unavailable database returns 503. Health endpoint is split into `/health/live` (always 200) and `/health/ready` (200 with database status in body). Existing `/health` endpoint is removed. Route tests use mock PlayerStore via existing `createTestContainer` override pattern.

## Acceptance Criteria

### player-stats-api.AC1: Player Registration
- **player-stats-api.AC1.1 Success:** `POST /player` returns 201 with a claim code in `ADJECTIVE-NOUN-NNNN` format
- **player-stats-api.AC1.2 Failure:** `POST /player` returns 503 when database is unavailable (`DatabaseUnavailableError` from PlayerStore)

### player-stats-api.AC2: Session Recording
- **player-stats-api.AC2.1 Success:** `POST /player/:code/session` with a new game returns 201 Created
- **player-stats-api.AC2.2 Success:** `POST /player/:code/session` with a previously recorded game returns 200 OK (no-op, no data modified)
- **player-stats-api.AC2.3 Failure:** `POST /player/:code/session` with unknown claim code returns 404
- **player-stats-api.AC2.4 Failure:** `POST /player/:code/session` with invalid or non-existent `gameId` returns 404
- **player-stats-api.AC2.5 Failure:** `POST /player/:code/session` returns 503 when database is unavailable

### player-stats-api.AC3: Stats Retrieval
- **player-stats-api.AC3.1 Success:** `GET /player/:code/stats` returns aggregated stats including gamesPlayed, gamesSolved, winRate, currentStreak, bestStreak, bestTime, averageTime, and recentSolves
- **player-stats-api.AC3.2 Success:** `recentSolves` contains last 30 days of solve times ordered by date ascending
- **player-stats-api.AC3.3 Edge:** Stats for a player with zero solves returns zeroed counts and null for bestTime/averageTime
- **player-stats-api.AC3.4 Failure:** `GET /player/:code/stats` with unknown claim code returns 404
- **player-stats-api.AC3.5 Failure:** `GET /player/:code/stats` returns 503 when database is unavailable

### player-stats-api.AC4: Health Endpoints
- **player-stats-api.AC4.1 Success:** `GET /health/live` always returns `200 { status: "ok" }`
- **player-stats-api.AC4.2 Success:** `GET /health/ready` returns `200` with `database: "unconfigured"` when `DATABASE_URL` is not set
- **player-stats-api.AC4.3 Success:** `GET /health/ready` returns `200` with `database: "connected"` when DB connection succeeds
- **player-stats-api.AC4.4 Success:** `GET /health/ready` returns `200` with `database: "error"` and `databaseError` detail when DB connection fails
- **player-stats-api.AC4.5 Success:** Existing `/health` endpoint removed, K8s probes updated to `/health/live` and `/health/ready`

## Glossary

- **Claim Code**: Human-readable player identifier in `ADJECTIVE-NOUN-NNNN` format (e.g., `CIPHER-TURING-7492`); functions as both identity and access token
- **Liveness Probe**: Kubernetes health check that determines if a container should be restarted; `/health/live` always returns 200 to indicate the process is running
- **PlayerStore**: Service interface defined in the [database layer design](2026-02-15-player-stats-database.md); provides methods for player registration, session recording, and stats aggregation
- **Readiness Probe**: Kubernetes health check that determines if a container should receive traffic; `/health/ready` always returns 200 but includes database status for operator visibility
- **schemaType()**: Wrapper function from `@eropple/fastify-openapi3` that generates named OpenAPI schema definitions from TypeBox types
- **Streak**: Count of consecutive calendar days with at least one puzzle solve; tracked as both current and historical best
- **TypeBox**: TypeScript library for defining JSON schema with strong typing; used for request/response validation in Fastify

## Architecture

### Overview

The system adds opt-in anonymous identity to Unquote. A player registers to receive a human-readable claim code (e.g., `CIPHER-TURING-7492`). The claim code is the player's only identity — no username, email, or password. After solving a puzzle, clients record the session to the server. Stats are derived from recorded sessions.

The claim code doubles as both identifier and access token. The threat model is minimal: the worst case is someone guessing a claim code and viewing puzzle solve times.

### Player Domain

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

// Path param for :code endpoints
const ClaimCodeParamsSchema = schemaType(
  "ClaimCodeParams",
  Type.Object({
    code: Type.String({ description: "Player claim code in ADJECTIVE-NOUN-NNNN format" }),
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

// POST /player/:code/session response
const RecordSessionResponseSchema = schemaType(
  "RecordSessionResponse",
  Type.Object({
    status: Type.Union([Type.Literal("created"), Type.Literal("recorded")]),
  }, { additionalProperties: false }),
);
```

### Health Endpoints

The existing `/health` endpoint is split into liveness and readiness probes:

- `GET /health/live` — always returns `200 { status: "ok" }`. Used by K8s liveness probe.
- `GET /health/ready` — always returns `200` but includes database status in the response body:

```json
{ "status": "ok", "database": "unconfigured" }
{ "status": "ok", "database": "connected" }
{ "status": "ok", "database": "error", "databaseError": "connection refused" }
```

**TypeBox schemas for health endpoints:**

```typescript
const HealthLiveResponseSchema = schemaType(
  "HealthLiveResponse",
  Type.Object({
    status: Type.Literal("ok"),
  }, { additionalProperties: false }),
);

const HealthReadyResponseSchema = schemaType(
  "HealthReadyResponse",
  Type.Object({
    status: Type.Literal("ok"),
    database: Type.Union([
      Type.Literal("unconfigured"),
      Type.Literal("connected"),
      Type.Literal("error"),
    ]),
    databaseError: Type.Optional(Type.String()),
  }, { additionalProperties: false }),
);
```

This is an intentional deviation from typical readiness probe semantics — since the primary function (puzzle serving) doesn't require the database, readiness always passes. The database status is informational for operators monitoring the player stats feature. The K8s deployment Terraform updates `livenessProbe` to `/health/live` and `readinessProbe` to `/health/ready`.

### Dependencies

This plan depends on [Player Stats: Database Layer](2026-02-15-player-stats-database.md) for the PlayerStore service, Drizzle schema, and branded types. Routes access the PlayerStore via `request.deps.playerStore` from the DI container.

The `DATABASE_URL` environment variable is added to the config schema as part of the database layer design.

**Error responses:** Error responses use Fastify's standard error format (`{ statusCode, error, message }`). The existing error handler in `src/index.ts` sanitizes 5xx details in production. No custom error schemas are needed.

## Existing Patterns

**API domain structure:** The `game` domain at `src/domain/game/` provides the pattern — domain directory with `routes/` subdirectory containing `index.ts` aggregator, individual route files, and `schemas.ts`. The new `player` domain follows this exactly.

**DI registration:** Services are added to `AppSingletonCradle` type and registered in `configureContainer()`. Test helpers extend `TestContainerOptions` with a mock `PlayerStore`.

**Route schemas:** All schemas use `schemaType()` wrapper from `@eropple/fastify-openapi3` with `Type` from `typebox`. Response types use `Static<typeof Schema>`.

**OpenAPI metadata:** Routes include `oas` fields (operationId, tags, summary) following the game routes pattern.

## Implementation Phases

<!-- START_PHASE_1 -->
### Phase 1: Player API Endpoints
**Goal:** REST endpoints for player registration, session recording, and stats

**Components:**
- Route schemas in `src/domain/player/routes/schemas.ts` using `schemaType()` and TypeBox
- `POST /player` route in `src/domain/player/routes/register.ts` — creates player, returns claim code
- `POST /player/:code/session` route in `src/domain/player/routes/session.ts` — validates `gameId` against the game generator before recording; records game session (201 Created new, 200 OK duplicate); maps PlayerStore's `"exists"` return value to `"recorded"` in the response schema
- `GET /player/:code/stats` route in `src/domain/player/routes/stats.ts` — returns aggregated stats and recent solves
- Route aggregator in `src/domain/player/routes/index.ts` (`registerPlayerRoutes`)
- Registration in `src/index.ts` under `/player` prefix
- Health endpoints remain in `src/routes/health.ts`, updated to export both `/health/live` and `/health/ready` routes replacing existing `/health`
- PlayerStore registered in `AppSingletonCradle` and accessed via `request.deps.playerStore` in route handlers
- `TestContainerOptions` in `tests/helpers/test-container.ts` extended with optional `playerStore` override
- Integration tests: `register.test.integration.ts`, `session.test.integration.ts`, `stats.test.integration.ts` in `src/domain/player/routes/` using mock PlayerStore via `createTestContainer`

**Dependencies:** [Player Stats: Database Layer](2026-02-15-player-stats-database.md) Phase 2 (PlayerStore)

**Done when:** All three player endpoints work correctly, return proper status codes (201/200 for sessions, 404 for unknown claim code, 503 when no database). Health endpoints return correct DB status (`unconfigured`/`connected`/`error`). Integration tests using mock PlayerStore via `createTestContainer`.
<!-- END_PHASE_1 -->

## Additional Considerations

**Claim code security:** Claim codes are intentionally not secrets. Rate limiting on the player endpoints (already provided by the global rate limiter) prevents brute-force enumeration. No additional auth is needed given the threat model (puzzle stats are not sensitive).

**K8s probe updates:** AC4.5 requires updating `livenessProbe` and `readinessProbe` paths in the Kubernetes deployment Terraform. This is an infrastructure change that accompanies the API deployment.
