# Player Stats TUI - Human Test Plan

## Prerequisites

- Built TUI binary: `cd tui && go build -o bin/unquote ./main.go`
- API server running locally or accessible at the configured URL
- `go test ./...` passing from `tui/` directory
- Clean config state: remove `~/.config/unquote/config.json` if present (backup first)
- Clean session state: remove `~/.local/state/unquote/sessions/` directory if present (backup first)

## Phase 1: Cobra CLI Basics

| Step | Action | Expected |
|------|--------|----------|
| 1.1 | Run `./bin/unquote` with no args | Onboarding form appears (if no config) or puzzle loads (if config exists). Program launches the Bubble Tea TUI. |
| 1.2 | Run `./bin/unquote version` | Prints "unquote" followed by version info (e.g., "unquote dev (none)"). No error. |
| 1.3 | Run `./bin/unquote --random` | Loads a random puzzle instead of today's puzzle. Verify the puzzle differs from today's by comparing encrypted text. |
| 1.4 | Run `./bin/unquote --help` | Prints usage with subcommands listed: version, register, link, claim-code, stats. Shows --random and --insecure flags. |
| 1.5 | Run `./bin/unquote --nonexistent` | Prints error about unknown flag. |

## Phase 2: Onboarding Flow (First Launch)

Prerequisite: Delete `~/.config/unquote/config.json` to simulate first launch.

| Step | Action | Expected |
|------|--------|----------|
| 2.1 | Run `./bin/unquote` | Onboarding form appears explaining what is stored and how claim codes work. Form presents opt-in/opt-out choice. |
| 2.2 | Select "Yes" to opt in, submit the form | TUI calls POST /player, receives a claim code. Claim code is displayed prominently on screen. |
| 2.3 | Verify `~/.config/unquote/config.json` exists | File should contain `"stats_enabled": true` and a non-empty `"claim_code"` matching what was displayed. |
| 2.4 | Press any key to continue past claim code display | Puzzle loads and game begins normally. |
| 2.5 | Quit and re-run `./bin/unquote` | Onboarding is skipped. Puzzle loads directly. |

## Phase 3: Onboarding Opt-Out Path

Prerequisite: Delete `~/.config/unquote/config.json`.

| Step | Action | Expected |
|------|--------|----------|
| 3.1 | Run `./bin/unquote`, select "No" to opt out | No API call to POST /player. Puzzle loads directly after form. |
| 3.2 | Verify `~/.config/unquote/config.json` | File should contain `"stats_enabled": false` and empty `"claim_code"`. |
| 3.3 | Quit and re-run `./bin/unquote` | Onboarding is skipped. Puzzle loads directly. |

## Phase 4: CLI Registration Commands

Prerequisite: Delete `~/.config/unquote/config.json`.

| Step | Action | Expected |
|------|--------|----------|
| 4.1 | Run `./bin/unquote register` | Calls POST /player. Prints claim code. Saves config. |
| 4.2 | Run `./bin/unquote register` again | Prints "Already registered" with the existing claim code. Does not call the API. |
| 4.3 | Run `./bin/unquote claim-code` | Prints the claim code from config. |
| 4.4 | Delete config, run `./bin/unquote claim-code` | Prints "No claim code found" with suggestion to run `unquote register`. |
| 4.5 | Run `./bin/unquote link SOME-CODE-1234` | Prints "Linked" with the code. Config saved with that code. |
| 4.6 | Run `./bin/unquote link` (no argument) | Prints error about missing required argument. |

## Phase 5: Post-Solve Session Recording

Prerequisite: Register a player via `./bin/unquote register` (or use existing config with claim code).

| Step | Action | Expected |
|------|--------|----------|
| 5.1 | Play and solve today's puzzle | Solved screen appears. No error messages. Session file written to `~/.local/state/unquote/sessions/`. |
| 5.2 | Check session file for the game ID | File contains `"solved": true`, `"uploaded": true`, and `"completion_time"` with a non-zero value. |
| 5.3 | Check server (via `GET /player/:code/stats`) | The solved session appears in the player's stats / recent solves. |

## Phase 6: Unregistered Player Solve

Prerequisite: Delete config or use config with `stats_enabled: false` and no claim code.

| Step | Action | Expected |
|------|--------|----------|
| 6.1 | Solve a puzzle | Solved screen shows tip: "Tip: run 'unquote register' to track your stats". No `[s] Stats` option in help bar. |
| 6.2 | Check session file | File contains `"solved": true`, `"uploaded": false`. |

## Phase 7: Stats Screen

Prerequisite: Registered player with at least one solved session uploaded.

| Step | Action | Expected |
|------|--------|----------|
| 7.1 | Solve a puzzle, press `s` on the solved screen | Stats screen loads. Shows solve-time graph (box-drawing characters) and sidebar with labels: Games Played, Games Solved, Win Rate, Current Streak, Best Streak, Best Time, Avg Time. Values are formatted (e.g., "95.7%", "2:08"). |
| 7.2 | Press `Esc` or `b` on stats screen | Returns to solved screen. |
| 7.3 | Run `./bin/unquote stats` | Stats screen appears directly (no puzzle). Shows same graph and sidebar data. |
| 7.4 | Press `Esc` on stats screen (via subcommand) | Program exits (not return to solved screen). |
| 7.5 | Run `./bin/unquote stats` with no config | Prints error: "No claim code found". |

## Phase 8: Stats Screen Edge Cases

| Step | Action | Expected |
|------|--------|----------|
| 8.1 | View stats for a player with no solves | Sidebar shows "0" for games solved, dashes for Best Time and Avg Time, "No solve history" instead of graph. |
| 8.2 | Press `s` on solved screen without claim code | Nothing happens. No state change, no error. |

## Phase 9: Session Reconciliation

| Step | Action | Expected |
|------|--------|----------|
| 9.1 | Delete config. Solve 2 puzzles (sessions saved locally, `uploaded: false`). Run `./bin/unquote register`. | Registration succeeds. After registration, check session files -- both should now have `"uploaded": true`. Server should have both sessions. |
| 9.2 | Manually edit a session file to set `"uploaded": false`. Restart `./bin/unquote`. | On startup, the un-uploaded session is re-submitted. After a moment, check the file -- should be `"uploaded": true` again. |
| 9.3 | Stop the API server. Run `./bin/unquote` as a registered player. | App launches normally, puzzle loads. Reconciliation failure is silent -- no error displayed, no delay. |

## End-to-End: Full Player Lifecycle

1. Remove all config and session state (`~/.config/unquote/` and `~/.local/state/unquote/`).
2. Run `./bin/unquote`. Onboarding appears.
3. Opt in. Claim code displayed. Note it down.
4. Press key to continue. Puzzle loads.
5. Solve the puzzle. Solved screen appears with `[s] Stats` in help bar.
6. Press `s`. Stats screen shows the just-completed session in graph and sidebar.
7. Press `Esc`. Return to solved screen.
8. Press `q` to quit.
9. Run `./bin/unquote claim-code`. Prints the same claim code from step 3.
10. Run `./bin/unquote stats`. Stats screen shows same data. Press `Esc` to exit.
11. Run `./bin/unquote` again. Onboarding is skipped. Puzzle loads. Previous session restored if same day.

## End-to-End: Registration After Prior Solves

1. Remove all config and session state.
2. Run `./bin/unquote`. Opt out of onboarding.
3. Solve 2 puzzles on different days (or use `--random` for distinct game IDs).
4. Verify session files exist with `"solved": true, "uploaded": false`.
5. Run `./bin/unquote register`.
6. Verify both session files now have `"uploaded": true`.
7. Run `./bin/unquote stats`. Both sessions appear in the stats.

## Traceability

| Acceptance Criterion | Automated Test | Manual Step |
|----------------------|----------------|-------------|
| AC1.1 -- No-args plays puzzle | `cmd/root_test.go` | Step 1.1 |
| AC1.2 -- Subcommands work | `cmd/{version,register,link,claimcode,stats}_test.go` | Steps 1.2, 4.1-4.6, 7.3, 7.5 |
| AC1.3 -- Flags work | `cmd/root_test.go` | Steps 1.3, 1.5 |
| AC2.1 -- First launch onboarding | `app/onboarding_test.go` | Step 2.1 |
| AC2.2 -- Opt-in registers player | `config/config_test.go`, `api/client_test.go`, `app/onboarding_test.go` | Steps 2.2, 2.3 |
| AC2.3 -- Opt-out saves disabled | `config/config_test.go`, `app/onboarding_test.go` | Steps 3.1, 3.2 |
| AC2.4 -- Skip onboarding on relaunch | `config/config_test.go`, `app/onboarding_test.go` | Steps 2.5, 3.3 |
| AC3.1 -- Solve records session | `api/client_test.go`, `app/recording_test.go` | Steps 5.1-5.3 |
| AC3.2 -- Uploaded marked true | `storage/session_test.go`, `app/recording_test.go` | Step 5.2 |
| AC3.3 -- Register hint | `app/recording_test.go` | Step 6.1 |
| AC3.4 -- Recording errors silent | `app/recording_test.go` | Step 9.3 |
| AC4.1 -- Stats graph and sidebar | `app/stats_test.go` | Steps 7.1, 8.1 |
| AC4.2 -- Stats from solved + subcommand | `app/stats_test.go`, `cmd/stats_test.go` | Steps 7.1, 7.3, 8.2 |
| AC4.3 -- Esc/b navigation | `app/stats_test.go` | Steps 7.2, 7.4 |
| AC5.1 -- Registration backfills | `app/recording_test.go` | Step 9.1 |
| AC5.2 -- Launch reconciles | `app/recording_test.go` | Step 9.2 |
| AC5.3 -- Idempotent reconciliation | `api/client_test.go` | Step 9.2 |
| AC5.4 -- Only solved sessions | `storage/session_test.go` | Step 9.1 |
| AC5.5 -- Reconciliation errors silent | `app/recording_test.go` | Step 9.3 |
