# Player Stats API - Human Test Plan

## Prerequisites

- The API is deployed to a staging or development environment with `DATABASE_URL` configured and pointing to a PostgreSQL instance with migrations applied
- A second environment (or the ability to unset `DATABASE_URL`) to test database-unconfigured behavior
- Run `pnpm run test` from `api/` and confirm all tests pass before manual verification
- `curl` or an HTTP client (Postman, httpie) available

## Phase 1: Player Registration

| Step | Action | Expected |
|------|--------|----------|
| 1.1 | Send `POST /player` with no request body | Response is 201 Created. Body contains `{ "claimCode": "<ADJECTIVE>-<NOUN>-<NNNN>" }` where ADJECTIVE and NOUN are uppercase words and NNNN is a 4-digit number. |
| 1.2 | Send `POST /player` again | Response is 201 Created with a different claim code than step 1.1 (codes are unique). |
| 1.3 | Record both claim codes for use in later phases. | N/A |

## Phase 2: Session Recording

| Step | Action | Expected |
|------|--------|----------|
| 2.1 | Send `GET /game/today` and note the `id` field from the response. | Response is 200 with a puzzle object containing an `id` field. |
| 2.2 | Send `POST /player/<code-from-1.1>/session` with body `{ "gameId": "<id-from-2.1>", "completionTime": 45000 }` | Response is 201 Created with `{ "status": "created" }`. |
| 2.3 | Repeat step 2.2 with the same code and game ID. | Response is 200 OK with `{ "status": "recorded" }` (idempotent -- already recorded). |
| 2.4 | Send `POST /player/<code-from-1.1>/session` with body `{ "gameId": "not-a-real-id", "completionTime": 30000 }` | Response is 404 Not Found. |
| 2.5 | Send `POST /player/NONEXISTENT-CODE-9999/session` with body `{ "gameId": "<id-from-2.1>", "completionTime": 30000 }` | Response is 404 Not Found. |

## Phase 3: Stats Retrieval

| Step | Action | Expected |
|------|--------|----------|
| 3.1 | Send `GET /player/<code-from-1.1>/stats` | Response is 200. Body contains `claimCode`, `gamesPlayed` (at least 1), `gamesSolved`, `winRate`, `currentStreak`, `bestStreak`, `bestTime`, `averageTime`, and `recentSolves` array. `bestTime` and `averageTime` are numbers (not null). `recentSolves` contains at least one entry with `date` and `completionTime` fields. |
| 3.2 | Send `GET /player/<code-from-1.2>/stats` (player registered in step 1.2, no sessions recorded) | Response is 200. `gamesPlayed` is 0, `gamesSolved` is 0, `winRate` is 0, `bestTime` is null, `averageTime` is null, `recentSolves` is an empty array. |
| 3.3 | Send `GET /player/NONEXISTENT-CODE-9999/stats` | Response is 404 Not Found. |

## Phase 4: Health Endpoints

| Step | Action | Expected |
|------|--------|----------|
| 4.1 | Send `GET /health/live` | Response is 200 with `{ "status": "ok" }`. |
| 4.2 | Send `GET /health/ready` (with database configured and reachable) | Response is 200 with `{ "status": "ok", "database": "connected" }`. |
| 4.3 | Stop the database (or point `DATABASE_URL` to an unreachable host), then send `GET /health/ready` | Response is 200 with `{ "status": "ok", "database": "error", "databaseError": "<message>" }`. |
| 4.4 | Start the API without `DATABASE_URL` set, then send `GET /health/ready` | Response is 200 with `{ "status": "ok", "database": "unconfigured" }`. |
| 4.5 | Send `GET /health` (the old endpoint) | Response is 404 Not Found (old endpoint removed). |
| 4.6 | Send `GET /openapi.json` and inspect the `paths` object | Paths include `/health/live` and `/health/ready`. No path `/health` with a GET operation exists. Player paths `/player`, `/player/{code}/session`, `/player/{code}/stats` are present. |

## End-to-End: Full Player Lifecycle

**Purpose:** Validate the complete flow from player registration through game play to stats retrieval, ensuring data persists correctly across endpoints.

1. `POST /player` -- record the returned `claimCode` (e.g., `CIPHER-TURING-7492`).
2. `GET /game/today` -- record the game `id`.
3. `POST /player/CIPHER-TURING-7492/session` with `{ "gameId": "<game-id>", "completionTime": 60000 }` -- expect 201.
4. `GET /player/CIPHER-TURING-7492/stats` -- expect `gamesPlayed >= 1`, `recentSolves` contains an entry for today's date with `completionTime: 60000`.
5. Re-submit step 3 -- expect 200 (idempotent).
6. `GET /player/CIPHER-TURING-7492/stats` again -- expect same stats as step 4 (no double counting).

## End-to-End: Database Unavailability Degradation

**Purpose:** Confirm that all player endpoints return 503 when the database is down, while the liveness probe remains healthy.

1. With a running API connected to PostgreSQL, verify `GET /health/ready` returns `database: "connected"`.
2. Stop the PostgreSQL server.
3. `GET /health/live` -- expect 200 `{ "status": "ok" }` (liveness unaffected).
4. `GET /health/ready` -- expect 200 with `database: "error"`.
5. `POST /player` -- expect 503.
6. `POST /player/<existing-code>/session` with valid payload -- expect 503.
7. `GET /player/<existing-code>/stats` -- expect 503.
8. Restart PostgreSQL. Verify `GET /health/ready` returns `database: "connected"` and player endpoints resume normal operation.

## Human Verification Required

| Criterion | Why Manual | Steps |
|-----------|------------|-------|
| player-stats-api.AC4.5 (K8s probes) | Kubernetes deployment configuration is infrastructure outside the API codebase; cannot be validated by API integration tests | Inspect the Kubernetes deployment manifest (e.g., `kubectl get deploy <name> -o yaml`). Confirm `livenessProbe.httpGet.path` is `/health/live` and `readinessProbe.httpGet.path` is `/health/ready`. Verify the probes target the correct port (3000 or the configured `PORT`). |

## Traceability

| Acceptance Criterion | Automated Test | Manual Step |
|----------------------|----------------|-------------|
| AC1.1 | `register.test.integration.ts` | Phase 1, steps 1.1-1.2 |
| AC1.2 | `register.test.integration.ts` | E2E: Database Unavailability, step 5 |
| AC2.1 | `session.test.integration.ts` | Phase 2, step 2.2 |
| AC2.2 | `session.test.integration.ts` | Phase 2, step 2.3 |
| AC2.3 | `session.test.integration.ts` | Phase 2, step 2.5 |
| AC2.4 | `session.test.integration.ts` | Phase 2, step 2.4 |
| AC2.5 | `session.test.integration.ts` | E2E: Database Unavailability, step 6 |
| AC3.1 | `stats.test.integration.ts` | Phase 3, step 3.1 |
| AC3.2 | `stats.test.integration.ts` | Phase 3, step 3.1 |
| AC3.3 | `stats.test.integration.ts` | Phase 3, step 3.2 |
| AC3.4 | `stats.test.integration.ts` | Phase 3, step 3.3 |
| AC3.5 | `stats.test.integration.ts` | E2E: Database Unavailability, step 7 |
| AC4.1 | `health.test.ts` | Phase 4, step 4.1 |
| AC4.2 | `health.test.ts` | Phase 4, step 4.4 |
| AC4.3 | `health.test.ts` | Phase 4, step 4.2 |
| AC4.4 | `health.test.ts` | Phase 4, step 4.3 |
| AC4.5 | `openapi.test.integration.ts` | Phase 4, steps 4.5-4.6; Human Verification |
