# Player Stats Database — Human Test Plan

## Prerequisites

- PostgreSQL instance accessible via connection string (e.g., local Docker: `docker run -d --name unquote-pg -e POSTGRES_PASSWORD=test -p 5432:5432 postgres:17`)
- API built: `cd api && pnpm run build`
- Automated tests passing: `pnpm run test` (141 tests, all green)
- Quotes file available at `api/resources/quotes.json`
- `DATABASE_URL` value: `postgresql://postgres:test@127.0.0.1:5432/postgres`

## Phase 1: Database Migration

| Step | Action | Expected |
|------|--------|----------|
| 1.1 | Run `DATABASE_URL=postgresql://postgres:test@127.0.0.1:5432/postgres QUOTES_FILE_PATH=resources/quotes.json node --import ./dist/instrumentation.js dist/index.js` from `api/packages/api/` | Server starts. Logs contain `"database connected and migrations applied"`. Server listens on port 3000. |
| 1.2 | Connect to PostgreSQL (`psql $DATABASE_URL`) and run `\dt` | Tables `players` and `game_sessions` exist. |
| 1.3 | Stop the server. Run `DATABASE_URL=postgresql://postgres:test@127.0.0.1:5432/postgres node dist/index.js migrate` from `api/packages/api/` | Stdout prints `"migrations completed successfully"`. Process exits with code 0. |
| 1.4 | Open 3 terminals. In each, run `DATABASE_URL=postgresql://postgres:test@127.0.0.1:5432/postgres node dist/index.js migrate` simultaneously | All 3 processes exit with code 0, no errors. Advisory lock serializes execution. |
| 1.5 | Start the API without `DATABASE_URL`: `QUOTES_FILE_PATH=resources/quotes.json node --import ./dist/instrumentation.js dist/index.js` | Server starts without database errors in logs. |
| 1.6 | With server from step 1.5 running, `curl -4 http://127.0.0.1:3000/health` | Returns `{"status":"ok"}` |
| 1.7 | With server from step 1.5 running, `curl -4 http://127.0.0.1:3000/game/today` | Returns a valid puzzle JSON (game endpoints work without database) |

## Phase 2: DI Container — playerStore null guard

| Step | Action | Expected |
|------|--------|----------|
| 2.1 | Start API without `DATABASE_URL` (as in step 1.5) | Server starts normally |
| 2.2 | Verify no player store is available by checking logs | No `"database connected"` message in logs. No errors related to player store. |
| 2.3 | (Deferred) When player API routes are implemented: call player endpoint | Returns HTTP 503 with body indicating database is unavailable |

## End-to-End: Full Player Lifecycle

**Purpose:** Validate that a player can be created, record sessions, and retrieve accurate stats through the store layer — confirming the entire database path works end-to-end with real PostgreSQL.

| Step | Action | Expected |
|------|--------|----------|
| E2E.1 | Start API with `DATABASE_URL` pointing to PostgreSQL | Server starts, logs show `"database connected and migrations applied"` |
| E2E.2 | Connect to PostgreSQL. Run `SELECT count(*) FROM players;` | Returns 0 (clean state) |
| E2E.3 | (When routes exist) POST to create player endpoint | Returns a claim code matching `ADJECTIVE-NOUN-NNNN` pattern |
| E2E.4 | (When routes exist) POST to record a session with the claim code | Returns `"created"` status |
| E2E.5 | (When routes exist) POST the same session again | Returns `"exists"` status (idempotent) |
| E2E.6 | (When routes exist) GET stats for the claim code | Returns `gamesPlayed: 1`, valid `bestTime`, `averageTime`, `currentStreak: 1` |

Note: Steps E2E.3-E2E.6 are deferred until API routes for player operations are implemented.

## End-to-End: Streak Accuracy Over Multiple Days

**Purpose:** Validate that streak calculations work correctly with real timestamps across day boundaries.

| Step | Action | Expected |
|------|--------|----------|
| S.1 | Connect to PostgreSQL with tables from a running API instance | Tables `players` and `game_sessions` exist |
| S.2 | Insert a player directly: `INSERT INTO players (id, claim_code) VALUES (gen_random_uuid(), 'TEST-STREAK-0001') RETURNING id;` | Row inserted, note the player UUID |
| S.3 | Insert sessions on 3 consecutive days ending today using the player UUID from S.2 | 3 rows inserted |
| S.4 | (When routes exist) GET stats for `TEST-STREAK-0001` | `currentStreak: 3`, `bestStreak: 3`, `gamesPlayed: 3`, `bestTime: 90`, `averageTime: 100` |

## Human Verification Required

| Criterion | Why Manual | Steps |
|-----------|------------|-------|
| AC1.1 - Migrations run at startup with advisory lock | Requires real PostgreSQL and full server startup | Steps 1.1, 1.2 |
| AC1.2 - CLI `migrate` command works | Requires built dist output and real PostgreSQL | Step 1.3 |
| AC1.3 - Concurrent migration safety | Requires multiple simultaneous processes | Step 1.4 |
| AC1.4 - API starts without DATABASE_URL | Requires full server startup and HTTP verification | Steps 1.5-1.7 |
| AC2.4 / AC3.4 / AC4.5 - DatabaseUnavailableError (503) | Route layer not yet implemented | Steps 2.1-2.3 |

## Traceability

| Acceptance Criterion | Automated Test | Manual Step |
|----------------------|----------------|-------------|
| AC1.1 - Migrations at startup | (PGlite `beforeAll` runs migrations) | Steps 1.1, 1.2 |
| AC1.2 - CLI migrate command | — | Step 1.3 |
| AC1.3 - Concurrent migration safety | — | Step 1.4 |
| AC1.4 - API without DATABASE_URL | — | Steps 1.5, 1.6, 1.7 |
| AC2.1 - Claim code format | `store.test.integration.ts` line 30 | — |
| AC2.2 - Unique claim codes | `store.test.integration.ts` line 35 | — |
| AC2.3 - Collision retry | `store.test.integration.ts` line 41 | — |
| AC2.4 - DatabaseUnavailableError | DI null wiring in `singleton.ts` | Steps 2.1-2.3 |
| AC3.1 - New session returns "created" | `store.test.integration.ts` line 52 | — |
| AC3.2 - Duplicate returns "exists" | `store.test.integration.ts` line 58 | — |
| AC3.3 - Unknown code throws error | `store.test.integration.ts` line 65 | — |
| AC3.4 - DatabaseUnavailableError | DI null wiring in `singleton.ts` | Steps 2.1-2.3 |
| AC4.1 - Correct aggregated stats | `store.test.integration.ts` line 91 | — |
| AC4.2 - Recent solves 30-day window | `store.test.integration.ts` line 106 | — |
| AC4.3 - Zero-solve stats | `store.test.integration.ts` line 71 | — |
| AC4.4 - Unknown code returns null | `store.test.integration.ts` line 86 | — |
| AC4.5 - DatabaseUnavailableError | DI null wiring in `singleton.ts` | Steps 2.1-2.3 |
| AC5.1 - Health check connected | `store.test.integration.ts` line 155 | — |
| AC5.2 - Health check error | `store.test.integration.ts` line 160 | — |
| AC6.1 - Consecutive streak | `store.test.integration.ts` line 195 | Step S.4 |
| AC6.2 - Best streak | `store.test.integration.ts` line 208 | — |
| AC6.3 - Streak reset on gap | `store.test.integration.ts` line 228 | — |
| AC6.4 - Same-day deduplication | `store.test.integration.ts` line 241 | — |
