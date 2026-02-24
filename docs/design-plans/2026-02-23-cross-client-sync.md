# Cross-Client Puzzle Completion Detection

## Summary

When a registered player solves today's cryptoquip on one device and then opens another client, that client currently has no way to know the puzzle was already solved — it presents the puzzle fresh. This feature adds a lightweight, non-blocking check that runs when either client loads today's puzzle and finds no local record of completion: it calls a new API endpoint (`GET /player/:code/session/:gameId`) to ask whether that player has a recorded session for this game. If the server confirms a session exists, the client transitions to a "solved elsewhere" state showing the original solve time. If the API call fails for any reason, the client silently falls through to normal gameplay.

The implementation is structured in three phases. First, the API gains the new session lookup endpoint, following patterns already established by the existing player routes. Second, the web client's game loader gains a third stage after its existing localStorage and API-fetch stages. Third, the TUI follows the same logic using Bubble Tea's command pattern. Because the check is driven entirely by the API, any future client that follows the same convention gets cross-client detection for free.

## Definition of Done

When a registered player solves today's puzzle on one client (web or TUI), the other client detects this on load and shows "Already solved on another device" with the solve time. The check is non-blocking — if the API call fails, the client falls through to normal gameplay. Works for any number of future clients since detection is API-driven.

**In scope:**
- Both web and TUI check for remote completion when loading today's puzzle (registered players only)
- Detection via existing stats endpoint OR a new `GET /player/:code/session/:gameId` endpoint
- Non-blocking: API failure gracefully falls through to normal gameplay
- Solved-elsewhere state displays completion time (e.g., "Solved in 0:53") without revealing the puzzle solution

**Out of scope:**
- Cross-client resume of in-progress games
- Authentication changes
- Changes to check/session recording flow (see #95)
- Full puzzle grid reveal when solved elsewhere

## Acceptance Criteria

### cross-client-sync.AC1: API session lookup endpoint
- **cross-client-sync.AC1.1 Success:** Returns 200 with `{completionTime, solvedAt}` when player has a recorded session for the given game ID
- **cross-client-sync.AC1.2 Success:** `completionTime` is in milliseconds, `solvedAt` is ISO 8601 timestamp
- **cross-client-sync.AC1.3 Failure:** Returns 404 when player exists but has no session for the given game ID
- **cross-client-sync.AC1.4 Failure:** Returns 404 when claim code does not match any player (does not leak player existence)
- **cross-client-sync.AC1.5 Failure:** Returns 503 when database is unavailable
- **cross-client-sync.AC1.6 Edge:** Returns 404 for an invalid/malformed game ID

### cross-client-sync.AC2: Web detects remote completion
- **cross-client-sync.AC2.1 Success:** Game page shows "Solved on another device" with formatted completion time when puzzle was solved on another client
- **cross-client-sync.AC2.2 Success:** Stats and share actions remain functional on the solved-elsewhere screen
- **cross-client-sync.AC2.3 Success:** Normal solved screen shown (with full grid) when puzzle was solved locally, even if remote session also exists
- **cross-client-sync.AC2.4 Failure:** Game loads normally (playing state) when API call returns 404
- **cross-client-sync.AC2.5 Failure:** Game loads normally (playing state) when API call fails due to network error
- **cross-client-sync.AC2.6 Edge:** Remote check is skipped entirely for anonymous players (no claim code)

### cross-client-sync.AC3: TUI detects remote completion
- **cross-client-sync.AC3.1 Success:** TUI shows solved state with "Solved on another device" and formatted completion time when puzzle was solved on another client
- **cross-client-sync.AC3.2 Success:** Stats key ('s') remains functional on the solved-elsewhere screen
- **cross-client-sync.AC3.3 Success:** Normal solved screen shown when puzzle was solved locally, even if remote session also exists
- **cross-client-sync.AC3.4 Failure:** Game loads normally (playing state) when API call returns 404
- **cross-client-sync.AC3.5 Failure:** Game loads normally (playing state) when API call fails due to network error
- **cross-client-sync.AC3.6 Edge:** Remote check is skipped entirely when no claim code is configured

## Glossary

- **claim code**: A human-readable identifier (e.g., `NORMAL-LEMMA-4272`) issued at registration, used as a bearer identifier for player-scoped API calls. Not secret — designed to be shareable across devices.
- **game ID**: An opaque server-assigned identifier for a specific puzzle instance. Returned by `GET /game/today` and used to correlate sessions across clients.
- **game session**: A database record created when a player completes a puzzle, storing the game ID, completion time, and solve timestamp. Written by `POST /player/:code/session`.
- **fire-and-forget**: The pattern used by both clients where session recording is called after solving but failures are silently swallowed. Relevant because this feature's detection depends on recording having succeeded.
- **"solved elsewhere" state**: A new client UI state distinct from the normal solved screen: shows completion time from the remote session without the filled-in puzzle grid.
- **local state always wins**: The design rule that the remote check is skipped if the client already has a local solved record, avoiding conflicts between local and remote state.
- **Bubble Tea command pattern**: The Elm-inspired async model used by the TUI. Side effects (API calls) are returned as `tea.Cmd` values from `Update()`; results arrive as typed messages in a subsequent `Update()` call.
- **TypeBox**: Schema library used by the API to define request/response shapes with runtime validation and static type inference.
- **Drizzle ORM**: The TypeScript ORM used to query PostgreSQL. The new endpoint adds a join query across `players` and `game_sessions`.

## Architecture

New `GET /player/:code/session/:gameId` endpoint returns whether a specific player has completed a specific game. Both clients call this endpoint when loading a puzzle that has no local solved state.

### API: Session Lookup Endpoint

```
GET /player/:code/session/:gameId

200 OK — session exists:
{
  "completionTime": 53260,
  "solvedAt": "2026-02-23T22:15:30.000Z"
}

404 Not Found — no session (or player not found)
```

The endpoint queries the `game_sessions` table by player claim code and game ID. Returns 404 for both "no session" and "player not found" to avoid leaking player existence. Rate limiting follows the global default (no per-route override needed since this is a read-only endpoint).

The store method joins `players` and `game_sessions` on `playerId` where `claimCode` matches and `gameId` matches, returning `completionTime` and `solvedAt` or null.

### Client: Detection Flow

Both web and TUI follow the same logic after loading today's puzzle:

1. Check local state (localStorage / XDG session file)
2. If locally solved → show normal solved screen (done)
3. If NOT locally solved AND player is registered → call `GET /player/:code/session/:gameId`
4. If 200 → transition to "solved elsewhere" state showing completion time
5. If 404 or network error → proceed to normal gameplay

**Local state always wins.** The remote check only fires when there's no local evidence of completion. This avoids merge conflicts between local and remote state.

### Client: "Solved Elsewhere" State

Both clients reuse the existing solved screen with a different subtitle:
- Display: "Solved on another device" with formatted completion time (e.g., "0:53")
- No puzzle grid reveal (the client doesn't have the guess mapping)
- Stats and share actions remain available (web), stats key still works (TUI)

## Existing Patterns

### API Patterns (followed)

Investigation of `api/packages/api/src/domain/player/routes/` found consistent patterns across all three existing player routes:

- **Route structure**: `FastifyPluginAsync` function registered via parent `index.ts` aggregator
- **Schema definition**: TypeBox schemas in `schemas.ts` with `schemaType()` wrapper and `Static<>` type exports
- **DI access**: `request.deps` with null guard, destructure `playerStore`
- **Error handling**: Custom `PlayerNotFoundError` → 404, `DatabaseUnavailableError` → 503
- **Store interface**: Methods defined in `types.ts`, implementation in `store.ts`

The new endpoint follows all of these exactly. No pattern divergence.

### Web Patterns (followed)

The `/game` page loader (`web/src/routes/game/+page.ts`) already implements a two-stage load: check localStorage, then fetch from API. The remote completion check adds a third stage after the existing flow, following the same non-blocking pattern used by `recordSession()` (fire-and-forget with `.catch()`).

Game state (`web/src/lib/state/game.svelte.ts`) has a `status` field with values `"playing" | "solved"`. The "solved elsewhere" state maps naturally to the existing `"solved"` status with an additional flag or field to indicate remote origin.

### TUI Patterns (followed)

The TUI uses Bubble Tea's command pattern for async operations. Remote completion check follows the same pattern as `fetchPuzzleCmd()` and `fetchStatsCmd()` — returns a message on completion, handled in `Update()`. The existing `StateSolved` state and solved view can be reused with a subtitle variation.

## Implementation Phases

<!-- START_PHASE_1 -->
### Phase 1: API — Session Lookup Endpoint

**Goal:** Add `GET /player/:code/session/:gameId` endpoint that returns completion status for a specific player+game combination.

**Components:**
- New store method `getSession(claimCode, gameId)` in `api/packages/api/src/domain/player/store.ts` — joins players and game_sessions, returns `{completionTime, solvedAt}` or null
- Store interface update in `api/packages/api/src/domain/player/types.ts` — add `getSession` to `PlayerStore` type
- TypeBox schemas in `api/packages/api/src/domain/player/routes/schemas.ts` — `GameSessionParams`, `GameSessionResponse`
- Route handler in `api/packages/api/src/domain/player/routes/session-lookup.ts` — GET handler with DI access, error handling
- Route registration in `api/packages/api/src/domain/player/routes/index.ts` — register the new route plugin
- Mock store update in test helpers — add `getSession` to mock

**Dependencies:** None (first phase)

**Done when:** Endpoint returns correct response for existing sessions, 404 for missing sessions/players, tests pass for all cases (cross-client-sync.AC1.*)
<!-- END_PHASE_1 -->

<!-- START_PHASE_2 -->
### Phase 2: Web — Remote Completion Detection

**Goal:** Web game loader checks the API for remote completions and shows "solved elsewhere" state when detected.

**Components:**
- New API client method `getSession(claimCode, gameId)` in `web/src/lib/api.ts` — calls `GET /player/:code/session/:gameId`, returns `{completionTime, solvedAt}` or null on 404
- Game loader update in `web/src/routes/game/+page.ts` — after local state check, if not locally solved and registered, call `getSession`
- Game state update in `web/src/lib/state/game.svelte.ts` — support "solved elsewhere" status (new field or status variant) with remote completion time
- Solved card update in `web/src/routes/game/+page.svelte` — show "Solved on another device" subtitle and remote completion time when in solved-elsewhere state

**Dependencies:** Phase 1 (API endpoint must exist)

**Done when:** Web shows "solved elsewhere" when puzzle was completed on TUI, falls through to gameplay on API error, tests pass (cross-client-sync.AC2.*)
<!-- END_PHASE_2 -->

<!-- START_PHASE_3 -->
### Phase 3: TUI — Remote Completion Detection

**Goal:** TUI checks the API for remote completions and shows "solved elsewhere" state when detected.

**Components:**
- New API client method `GetSession(claimCode, gameId)` in `tui/internal/api/client.go` — calls `GET /player/:code/session/:gameId`, returns session data or nil on 404
- New Bubble Tea command `checkRemoteSessionCmd()` in `tui/internal/app/commands.go` — fires after puzzle load if no local session
- New message type `remoteSessionMsg` in `tui/internal/app/messages.go` (or equivalent) — carries remote session data
- Update handler in `tui/internal/app/update.go` — handle `remoteSessionMsg`, transition to solved state with "solved elsewhere" display
- View update in `tui/internal/app/view.go` — show "Solved on another device" subtitle in solved view

**Dependencies:** Phase 1 (API endpoint must exist)

**Done when:** TUI shows "solved elsewhere" when puzzle was completed on web, falls through to gameplay on API error, tests pass (cross-client-sync.AC3.*)
<!-- END_PHASE_3 -->

## Additional Considerations

**Depends on session recording reliability:** This feature only works when the original client's `POST /player/:code/session` call succeeded. Since session recording is fire-and-forget in both clients, a network failure at solve time means the remote check will return 404. Issue #95 tracks making solve recording atomic. This is an accepted limitation for now.

**Future extensibility:** The `GET /player/:code/session/:gameId` response shape can later include a `guesses` field (cipher→plain mapping) to enable cross-client resume without changing the endpoint contract.
