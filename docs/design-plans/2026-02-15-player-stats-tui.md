# Player Stats: TUI Integration

## Summary

This plan extends the TUI to support opt-in player stats tracking via the API's claim code system. Players who register receive a randomly-generated claim code (e.g., `TIGER-MAPLE-7492`) that identifies them without requiring account creation or personal information. The TUI stores this claim code in an XDG config file and uses it to record solve sessions to the server after successful puzzles. A stats screen visualizes solve-time trends over the last 30 days using an ASCII line graph, alongside summary metrics like win rate and streaks.

The implementation migrates the CLI from Go's `flag` package to cobra to support subcommands (`register`, `link`, `stats`, `claim-code`, `version`). First-time users encounter an interactive onboarding form (built with the huh library) that explains what data is tracked and how claim codes work. Players who opt out never see stats-related features and experience the TUI unchanged. Session reconciliation ensures that pre-registration solves are backfilled on registration, and any unuploaded sessions are retried on each launch. All stats features are best-effort: API errors are silently ignored to ensure the core puzzle experience is never interrupted.

## Definition of Done

The TUI migrates from `flag` to cobra for subcommand support. `unquote` (no args) plays today's puzzle identically to current behavior; `--random` and `--insecure` flags work unchanged. New subcommands: `register`, `link <code>`, `stats`, `claim-code`, `version`. A config file at `~/.config/unquote/config.json` stores claim code and stats opt-in preference. First launch with no config shows an interactive onboarding form explaining what's stored and how claim codes work. Opting in registers with the API and saves the claim code; opting out saves the preference and proceeds to puzzle. After a successful solve, registered players' sessions are recorded to the server (errors silently ignored). Unregistered players see a hint to register. A stats screen shows a solve-time graph (last 30 days) and summary sidebar, accessible from the solved screen or via `unquote stats`. Session reconciliation backfills pre-registration solves on registration and retries un-uploaded sessions on each launch.

## Acceptance Criteria

### player-stats-tui.AC1: Cobra CLI
- **player-stats-tui.AC1.1 Success:** `unquote` (no args) plays today's puzzle, identical to current behavior
- **player-stats-tui.AC1.2 Success:** `unquote register`, `unquote link <code>`, `unquote stats`, `unquote claim-code`, and `unquote version` subcommands work
- **player-stats-tui.AC1.3 Success:** `--random` and `--insecure` flags work identically to current behavior

### player-stats-tui.AC2: Onboarding
- **player-stats-tui.AC2.1 Success:** First launch with no config shows onboarding form explaining what's stored and how claim codes work
- **player-stats-tui.AC2.2 Success:** Opting in calls `POST /player`, saves claim code and `stats_enabled: true` to config, displays claim code
- **player-stats-tui.AC2.3 Success:** Opting out saves `stats_enabled: false` to config, proceeds to puzzle
- **player-stats-tui.AC2.4 Edge:** Subsequent launches with existing config skip onboarding entirely

### player-stats-tui.AC3: Post-Solve Recording
- **player-stats-tui.AC3.1 Success:** Solving a puzzle as a registered player records the session via `POST /player/:code/session`
- **player-stats-tui.AC3.2 Success:** Successfully uploaded sessions are marked `uploaded: true` in local storage
- **player-stats-tui.AC3.3 Success:** Unregistered players see hint: "Tip: run 'unquote register' to track your stats" on solved screen
- **player-stats-tui.AC3.4 Failure:** Recording errors are silently ignored — solve flow is never interrupted

### player-stats-tui.AC4: Stats Screen
- **player-stats-tui.AC4.1 Success:** Stats screen shows solve-time graph (last 30 days) and summary sidebar
- **player-stats-tui.AC4.2 Success:** Stats screen accessible from solved screen and via `unquote stats` subcommand
- **player-stats-tui.AC4.3 Success:** Press `Esc` or `b` returns to previous screen or exits (subcommand context)

### player-stats-tui.AC5: Session Reconciliation
- **player-stats-tui.AC5.1 Success:** On registration, TUI backfills pre-registration solved sessions to the server
- **player-stats-tui.AC5.2 Success:** On each launch (when registered), sessions without `uploaded: true` are re-submitted
- **player-stats-tui.AC5.3 Success:** Server returns 200 OK for already-recorded sessions, making reconciliation idempotent
- **player-stats-tui.AC5.4 Failure:** Reconciliation errors are silently ignored — app launch is never blocked

## Glossary

- **Asciigraph**: Go library for rendering line charts in terminal output using ASCII art; used to visualize solve-time trends
- **Bubble Tea**: Elm-inspired framework for building terminal UIs in Go; based on the Model-View-Update (MVU) architecture where state changes happen via messages and commands
- **Claim Code**: Randomly-generated identifier in `ADJECTIVE-NOUN-NNNN` format (e.g., `TIGER-MAPLE-7492`) serving as a player's anonymous identity; stored in plaintext locally and used to link sessions to a player record
- **Cmd (Bubble Tea)**: Function that performs asynchronous work (API calls, file I/O) and returns a message when complete; non-blocking and integrates with the Bubble Tea event loop
- **Cobra**: Go library for building CLI applications with subcommands and flags; provides command structure, help text generation, and argument parsing
- **Huh**: Charmbracelet library for building interactive TUI forms with validation, multi-step flows, and styled prompts; used for the onboarding flow
- **Lip Gloss**: Charmbracelet library for styling terminal output with colors, borders, padding, and alignment; used for the stats summary sidebar
- **Reconciliation**: Process of syncing local state with remote state; the TUI re-uploads any sessions that weren't successfully recorded
- **State (TUI)**: Iota-based enumeration representing the current screen or mode of the application (e.g., `StateLoading`, `StateOnboarding`, `StateStats`); the view function switches on `m.state`
- **Streak**: Count of consecutive calendar days with at least one solved puzzle; resets when a day is missed
- **XDG Base Directory**: Unix specification for standard config/data/cache locations; `~/.config/` for user config, `~/.local/state/` for session data

## Architecture

### Overview

The TUI gains opt-in player identity via the API's claim code system. Players who register receive a claim code stored locally in an XDG config file. The TUI records solve sessions to the server after successful puzzles and can display aggregated stats. Players who don't opt in experience no change to existing behavior.

### Data Flow

```
First Launch (no config):
  TUI shows onboarding screen (huh form) → user opts in →
  TUI calls POST /player → API generates claim code, creates DB row →
  API returns claim code → TUI saves to XDG config

On Solve (registered player):
  TUI verifies solution via POST /game/:id/check (unchanged) →
  if correct AND stats_enabled: TUI calls POST /player/:code/session →
  API records game_id, completion_time, solved_at

Stats View:
  TUI calls GET /player/:code/stats →
  API queries game_sessions, returns aggregated stats + last 30 days of solve times →
  TUI renders stats screen with graph and sidebar
```

### Cobra CLI Structure

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

The root command's `RunE` function handles the default game behavior (play today's puzzle). Subcommands are registered as children. When `unquote` is invoked with no args and no subcommand, cobra runs the root `RunE`. Flags (`--random`, `--insecure`) are registered as persistent flags on the root command so they're available to all subcommands.

### Config File

New `internal/config/` package, mirroring `internal/storage/` patterns including `os.OpenRoot()` for path traversal prevention, but using `xdg.ConfigFile` instead of `xdg.StateFile`.

```
~/.config/unquote/config.json
```

```json
{
  "claim_code": "TIGER-MAPLE-7492",
  "stats_enabled": true
}
```

### Onboarding Flow

On first launch, if no config file exists at `~/.config/unquote/config.json`, the app enters `StateOnboarding` before loading a puzzle. Uses `charmbracelet/huh` to render an interactive form explaining the stats system and asking the user to opt in.

The form shows:
- What data is stored (which puzzles solved, how long they took)
- What is NOT stored (no personal info)
- How claim codes work (random code = your identity, not a password)
- A confirm group: "Yes, track my stats" / "No thanks"

The onboarding form uses a `huh.Group` with a `huh.Note` for the privacy explanation and a `huh.Confirm` for the opt-in prompt. The note text is static; the confirm defaults to 'Yes'.

"Yes" calls `POST /player`, saves claim code and `stats_enabled: true` to config, displays the claim code with a "save this" message, then transitions to `StateLoading`. After registration, the claim code is displayed in a styled box with the message 'Your claim code is: ADJECTIVE-NOUN-NNNN — save this to access your stats from another device.' The user presses any key to continue to `StateLoading`.

"No thanks" saves `stats_enabled: false` to config, transitions to `StateLoading`. Never shown again.

If `POST /player` fails (network error, 503), the onboarding form displays an error message and offers retry or opt-out. Registration failure never blocks the user from playing — they can always opt out and try again later via `unquote register`.

### Stats Screen

New `StateStats` accessible from the solved screen or via `unquote stats` subcommand. From the solved screen, press `s` to view stats. The stats option appears in the solved screen's footer alongside existing navigation hints.

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

Solve times are received from the API in milliseconds and formatted as `M:SS` for display (e.g., 128000ms → `2:08`).

Press `Esc` or `b` to return. If accessed from solved screen, returns to solved screen. If accessed via `unquote stats`, exits the program.

### Post-Solve Session Recording

After a successful solve, if `stats_enabled` and `claim_code` are set in config, the TUI fires a background command (`recordSessionCmd`) that calls `POST /player/:code/session`. Errors are silently ignored — stats recording is best-effort and must never interrupt gameplay.

Successfully uploaded sessions are marked with `uploaded: true` in the local session JSON (new field on `GameSession` struct).

A hint line appears on the solved screen if the player is NOT registered (no config file): `Tip: run 'unquote register' to track your stats`. Shown only when no config exists.

### Session Reconciliation

On registration, the TUI scans local session files for solved games and bulk-submits them to the server (backfill of pre-registration history). On each subsequent launch (when registered), any solved sessions without `uploaded: true` are re-submitted. The server returns `200 OK` for already-recorded sessions, making reconciliation simple fire-and-forget. Reconciliation errors are silently ignored.

Only sessions where `Solved: true` and `Uploaded: false` (or field absent) are submitted during reconciliation. Unsolved sessions are never sent to the server.

### Dependencies

This plan depends on [Player Stats: API Endpoints](2026-02-15-player-stats-api.md) for the REST endpoint contracts (`POST /player`, `POST /player/:code/session`, `GET /player/:code/stats`).

## Existing Patterns

**TUI storage:** `internal/storage/` uses `xdg.StateFile()` with `os.OpenRoot()` for path traversal prevention. The new `internal/config/` package replicates this pattern with `xdg.ConfigFile()`.

**TUI commands:** `internal/app/commands.go` defines Bubble Tea `Cmd` functions for async operations. New commands (`registerPlayerCmd`, `recordSessionCmd`, `fetchStatsCmd`) follow this pattern.

**TUI states:** Model states are `State` iota constants. The view switches on `m.state`. New states (`StateOnboarding`, `StateStats`) follow this pattern.

**Testing:** Cobra commands are tested via `cmd.Execute()` with captured stdout/stderr. Bubble Tea model tests use `tea.NewProgram` with `tea.WithInput` for simulated input. API client methods are tested with `httptest.NewServer` for HTTP stubbing. The onboarding form (huh) is tested via its model API rather than visual rendering.

## Implementation Phases

<!-- START_PHASE_1 -->
### Phase 1: Cobra CLI Migration
**Goal:** Replace `flag` package with cobra for subcommand support

**Components:**
- `cobra` dependency added to `tui/go.mod`
- Root command in `tui/cmd/root.go` — replaces `main.go` flag parsing, runs the game
- `version` subcommand in `tui/cmd/version.go`
- `main.go` simplified to call `cmd.Execute()`
- Existing flags (`--random`, `--insecure`) migrated to cobra persistent/local flags

**Dependencies:** None

**Done when:** `unquote`, `unquote --random`, `unquote --insecure`, and `unquote version` all work identically to current behavior. Build and tests pass.
<!-- END_PHASE_1 -->

<!-- START_PHASE_2 -->
### Phase 2: Config and Player API Client
**Goal:** XDG config file support and API client methods for player endpoints

**Components:**
- `internal/config/` package — load/save config from `~/.config/unquote/config.json` using `xdg.ConfigFile()`
- New API client methods in `internal/api/client.go` — `RegisterPlayer()`, `RecordSession()`, `FetchStats()` with the following contracts:
  ```go
  RegisterPlayer() (*RegisterPlayerResponse, error)
  RecordSession(claimCode, gameID string, completionTime int) error
  FetchStats(claimCode string) (*PlayerStatsResponse, error)
  ```
  These follow the existing pattern in `client.go` where methods return `(*Type, error)`.
- Response types in `internal/api/types.go`: `RegisterPlayerResponse` (ClaimCode string), `PlayerStatsResponse` (all fields from API stats schema), `RecordSessionRequest` (GameID string, CompletionTime int)
- `GameSession` struct in `internal/storage/session.go` extended with `Uploaded bool` field and corresponding JSON tag `uploaded`
- New `ListSolvedSessions()` function in `internal/storage/` — returns all locally stored sessions where `Solved: true`, enabling reconciliation to find un-uploaded solves

**Dependencies:** Phase 1 (cobra structure). API client methods can be written and unit-tested with HTTP stubs independent of the live API — full integration testing happens after the API endpoints from [Player Stats: API Endpoints](2026-02-15-player-stats-api.md) are deployed.

**Done when:** Config loads/saves correctly, API client methods work against the player endpoints. Tests verify config persistence and API client behavior.
<!-- END_PHASE_2 -->

<!-- START_PHASE_3 -->
### Phase 3: Onboarding Flow
**Goal:** First-launch interactive onboarding with huh form

**Components:**
- `charmbracelet/huh` dependency added to `tui/go.mod`
- `StateOnboarding` state added to model
- Onboarding view using huh form — privacy explanation and opt-in prompt
- Claim code display after registration
- Transition to `StateLoading` after onboarding completes
- `register` and `link` subcommands in `tui/cmd/`
- `claim-code` subcommand in `tui/cmd/`

**Dependencies:** Phase 2

**Done when:** First launch shows onboarding when no config exists, "Yes" registers and saves claim code, "No" saves opt-out. Subcommands work for registration, linking, and displaying claim code. Subsequent launches skip onboarding.
<!-- END_PHASE_3 -->

<!-- START_PHASE_4 -->
### Phase 4: Post-Solve Session Recording
**Goal:** Automatic session recording after successful solves

**Components:**
- `recordSessionCmd` in `internal/app/commands.go` — calls `POST /player/:code/session`
- Integration in `handleSolutionChecked()` in `update.go` — fires `recordSessionCmd` after successful solve when registered
- Hint message on solved screen when not registered: "Tip: run 'unquote register' to track your stats"
- `reconcileSessionsCmd` in `internal/app/commands.go` — scans local sessions without `uploaded: true` and submits them to server
- Reconciliation triggered on app launch when registered (before puzzle load) and on registration (backfill pre-existing solves)

**Dependencies:** Phase 3

**Done when:** Solving a puzzle as a registered player records the session server-side. Errors in recording don't affect the solve flow. Unregistered players see the hint. Session reconciliation backfills on registration and retries un-uploaded sessions on launch. Reconciliation errors are silently ignored.
<!-- END_PHASE_4 -->

<!-- START_PHASE_5 -->
### Phase 5: Stats Screen
**Goal:** In-game stats visualization with graph and summary

**Components:**
- `asciigraph` dependency added to `tui/go.mod`
- `StateStats` state added to model
- `fetchStatsCmd` in `commands.go` — calls `GET /player/:code/stats`
- Stats view with asciigraph line chart (last 30 days solve times) and Lip Gloss sidebar (summary stats)
- Navigation: accessible from solved screen via button/key, or via `unquote stats` subcommand
- `stats` subcommand in `tui/cmd/`

**Dependencies:** Phase 4

**Done when:** Stats screen renders correctly with graph and sidebar, data loads from API, navigation works from both solved screen and CLI subcommand.
<!-- END_PHASE_5 -->

## Additional Considerations

**Offline/degraded mode:** If the player API is unreachable (network error, 503), the TUI silently skips session recording and stats display. The core puzzle experience is never affected by player feature availability.
