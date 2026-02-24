# Cross-Client Sync — Human Test Plan

## Prerequisites

- API server running locally with PostgreSQL configured (`DATABASE_URL` set, migrations applied)
- Web frontend running via `pnpm run dev` from `web/` (with `VITE_API_URL=http://localhost:3000`)
- TUI binary built via `go build -o bin/unquote ./main.go` from `tui/`
- TUI configured with `UNQUOTE_API_URL=http://localhost:3000` and `--insecure` flag
- All automated tests passing:
  - `cd api && pnpm run test` (172 passing)
  - `cd web && pnpm run test` (78 passing)
  - `cd tui && go test ./...` (all passing)

## Phase 1: Web Remote Completion Display (AC2.1 visual)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Register a player on the TUI: `./bin/unquote register --insecure`. Note the claim code displayed (e.g., `CIPHER-TURING-7492`). | Claim code is displayed in `ADJECTIVE-NOUN-NNNN` format. |
| 2 | Solve today's puzzle on the TUI to completion. After the congratulations screen appears, press `Esc` to quit. | TUI shows "Congratulations! You solved it in M:SS!" and the session is recorded to the API. |
| 3 | Open the web frontend at `http://localhost:5173/`. | Landing page / onboarding screen appears. |
| 4 | During onboarding, choose "I already have a claim code" and enter the same claim code from step 1. Click Continue. | Web client redirects to `/game`. |
| 5 | Observe the game screen. | The solved card appears with: (a) the eyebrow text "Already Solved", (b) the message "Solved on another device", (c) the completion time formatted as M:SS matching what the TUI displayed. No decoded quote or author attribution is shown. The card fades in immediately without a grid animation. |

## Phase 2: Web Stats and Share on Solved-Elsewhere (AC2.2)

| Step | Action | Expected |
|------|--------|----------|
| 1 | With the solved-elsewhere card displayed from Phase 1, look at the page header/navigation. | A "Stats" link is visible in the header. |
| 2 | Click the "Stats" link. | Browser navigates to `/stats`. |
| 3 | Observe the stats page. | Stats data loads and displays correctly (games played, win rate, streaks, etc.) reflecting the session recorded by the TUI. |

## Phase 3: Web Graceful Fallback on 404 (AC2.4)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Clear the web client's localStorage (DevTools > Application > Local Storage > Clear). | Storage is empty. |
| 2 | Register a new player on the web (go through onboarding and choose "Yes, track my stats"). | New claim code is assigned, redirects to `/game`. |
| 3 | Observe the game screen. The new player has no sessions recorded on any other device. | Game loads in playing state with an empty grid ready for input. No "Solved on another device" card appears. The remote session lookup returned 404, which was silently ignored. |

## Phase 4: Web Graceful Fallback on Network Error (AC2.5)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Stop the API server (kill the process). | API is unreachable. |
| 2 | Open the web client at `http://localhost:5173/game` (ensure a previous puzzle is cached in localStorage from a prior session, or complete steps 1-3 of Phase 3 first while the API is running and then stop the API and reload). | If the puzzle was previously cached in localStorage, the game loads from cache and enters playing state. The remote session check fails silently. If there is no cache, the game shows an error state ("Could not load today's puzzle"). |
| 3 | Restart the API server. | API is reachable again (for subsequent test phases). |

## Phase 5: Web Anonymous Player Skip (AC2.6)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Clear the web client's localStorage. | Storage is empty. |
| 2 | Go through onboarding and choose "No thanks" (skip registration). | Web client redirects to `/game` without a claim code. |
| 3 | Open browser DevTools > Network tab and observe the requests made during page load. | The game loads directly to playing state. There is no request to `/player/*/session/*` in the network tab. The remote check was skipped entirely because no claim code is configured. |

## End-to-End: Cross-Client Round Trip

**Purpose:** Validates the complete cross-client sync flow from session recording on one client to detection on another, covering AC1 (API), AC2 (web), and AC3 (TUI) in a single scenario.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Register a player on the web frontend. Note the claim code. | Claim code displayed. |
| 2 | Link the same claim code to the TUI: `./bin/unquote link --insecure`, enter the claim code. | TUI confirms the claim code is linked. |
| 3 | Solve today's puzzle on the web frontend. Note the completion time displayed. | Web shows the congratulations card with the decoded quote and completion time. |
| 4 | Launch the TUI: `./bin/unquote --insecure`. | TUI fetches today's puzzle, loads any local session, then checks for remote completion. |
| 5 | Observe the TUI screen. | TUI transitions to the solved state showing "Solved on another device in M:SS" where the time matches the web's completion time. The `[s] Stats` key binding is displayed in the help bar. |
| 6 | Press `s` on the TUI. | TUI navigates to the stats screen showing the player's aggregated data including the session just recorded from the web. |
| 7 | Press `b` or `Esc` to return from stats, then `Esc` to quit. | TUI exits cleanly. |

## End-to-End: Race Condition -- Local Solve During Remote Check

**Purpose:** Validates that if the player starts solving while the remote check is in flight, the local solve result takes precedence (AC2.3, AC3.3).

| Step | Action | Expected |
|------|--------|----------|
| 1 | Set up a registered player with no sessions for today's puzzle. | Clean state. |
| 2 | On the web client, load the game page. While the page is loading (remote check in flight), quickly begin solving the puzzle. | The remote check returns 404 (no session). The game remains in playing state. Player can solve normally. |
| 3 | Complete the puzzle locally. | Local solve is recorded. The congratulations card shows the decoded quote and local completion time. `solvedElsewhere` is false. |
| 4 | Reload the page. | Game resumes from localStorage with `status: "solved"` and `solvedElsewhere: false`. The normal solved card is shown (with decoded quote), not the solved-elsewhere card. |

## Traceability

| Acceptance Criterion | Automated Test | Manual Step |
|----------------------|----------------|-------------|
| cross-client-sync.AC1.1 | `store.test.integration.ts` line 118; `session-lookup.test.integration.ts` line 12 | -- |
| cross-client-sync.AC1.2 | `session-lookup.test.integration.ts` line 34 | -- |
| cross-client-sync.AC1.3 | `store.test.integration.ts` line 134; `session-lookup.test.integration.ts` line 54 | -- |
| cross-client-sync.AC1.4 | `store.test.integration.ts` line 146; `session-lookup.test.integration.ts` line 75 | -- |
| cross-client-sync.AC1.5 | `session-lookup.test.integration.ts` line 96 | -- |
| cross-client-sync.AC1.6 | `session-lookup.test.integration.ts` line 113 | -- |
| cross-client-sync.AC2.1 | `game.svelte.test.ts` lines 69, 76, 173 (state transitions and persistence) | Phase 1 steps 1-5 (visual rendering) |
| cross-client-sync.AC2.2 | -- | Phase 2 steps 1-3 |
| cross-client-sync.AC2.3 | `game.svelte.test.ts` line 83 | -- |
| cross-client-sync.AC2.4 | -- | Phase 3 steps 1-3 |
| cross-client-sync.AC2.5 | -- | Phase 4 steps 1-3 |
| cross-client-sync.AC2.6 | -- | Phase 5 steps 1-3 |
| cross-client-sync.AC3.1 | `remote_session_test.go` line 18 | -- |
| cross-client-sync.AC3.2 | `remote_session_test.go` line 68 | -- |
| cross-client-sync.AC3.3 | `remote_session_test.go` line 94 | -- |
| cross-client-sync.AC3.4 | `client_test.go` line 587; `remote_session_test.go` line 126 | -- |
| cross-client-sync.AC3.5 | `client_test.go` line 607; `remote_session_test.go` line 150 | -- |
| cross-client-sync.AC3.6 | `remote_session_test.go` lines 174, 210 | -- |
