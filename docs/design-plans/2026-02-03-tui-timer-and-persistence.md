# TUI Timer and Session Persistence Design

## Summary

This design adds a running timer and session persistence to the Unquote TUI, allowing players to track solve times and resume puzzles across app restarts. The timer displays elapsed time in MM:SS format during gameplay and shows completion time when a puzzle is solved. Session persistence stores game state (letter inputs and accumulated time) in platform-appropriate directories using the `adrg/xdg` library, with one JSON file per game ID. When returning to a puzzle, the TUI restores progress for unsolved games or displays a completion message with the solve time for already-solved games.

The implementation integrates timer and persistence as orthogonal concerns within the existing Bubble Tea architecture. The timer works through model fields tracking start time and paused duration, with a tick message firing every second to trigger re-renders during active play. Persistence happens through a new `internal/storage/` package that handles session I/O, saving state after each letter input and on puzzle completion.

## Definition of Done

- Timer displays elapsed time during gameplay (MM:SS format)
- Completion time shown when puzzle is solved
- Game state (inputs, timer) persists between sessions by game ID
- Returning to a solved puzzle shows "already solved" with completion time
- Session data stored in platform-appropriate directory (XDG on Linux, Application Support on macOS, LOCALAPPDATA on Windows)

## Glossary

- **Bubble Tea**: TUI framework for Go using the Elm Architecture pattern (Model-Update-View)
- **Model**: Central state struct holding all application data (game state, UI state, timer fields)
- **Update**: Function that receives messages and returns updated model plus optional commands
- **Command (tea.Cmd)**: Function that performs side effects (I/O, timers) and returns messages asynchronously
- **XDG**: Cross-Desktop Group base directory specification for storing user-specific data files
- **adrg/xdg**: Go library providing cross-platform access to XDG directories (Linux/macOS/Windows)
- **tickMsg**: Custom message type triggering timer re-render, fired every second during gameplay
- **Session**: Persisted game state including letter inputs, accumulated time, and completion status
- **StatePlaying**: Game state enum value indicating active gameplay

## Architecture

Timer and persistence as orthogonal concerns integrated into the existing Bubble Tea model.

**Timer:** Model tracks `startTime` and `elapsedAtPause`. Display calculated as `elapsedAtPause + time.Since(startTime)`. A `tickMsg` fires every second while in `StatePlaying` to trigger re-render. Timer pauses automatically in non-playing states.

**Persistence:** New `internal/storage/` package handles session I/O. One JSON file per game ID stored in platform state directory via `adrg/xdg` library. Sessions save after each input and on solve. On startup, existing session restores inputs and accumulated time.

**Data flow:**
1. Puzzle fetched from API → check for existing session
2. Session exists + solved → show completion view
3. Session exists + not solved → restore state, resume timer
4. No session → fresh start
5. During play → save on each input
6. On solve → save with completion flag and time

## Existing Patterns

Investigation found the TUI follows Bubble Tea conventions:
- Model struct in `internal/app/model.go` holds all state
- Update handlers in `internal/app/update.go` process messages
- Commands in `internal/app/commands.go` return `tea.Cmd` for async operations

This design follows those patterns:
- Timer fields added to existing Model
- Tick message handled in existing update loop
- Storage operations wrapped as commands

New pattern introduced: `internal/storage/` package for file I/O. No existing persistence in codebase. Pattern follows Go convention of domain-specific internal packages.

## Implementation Phases

<!-- START_PHASE_1 -->
### Phase 1: Timer Display
**Goal:** Show running timer during gameplay and completion time on solve

**Components:**
- Model in `internal/app/model.go` — add `startTime time.Time`, `elapsedAtPause time.Duration`
- Messages in `internal/app/messages.go` — add `tickMsg` type
- Commands in `internal/app/commands.go` — add `tickCmd()` returning `tea.Tick`
- Update in `internal/app/update.go` — handle tick, start timer on puzzle load
- View in `internal/app/view.go` — render timer in playing view, show completion time in solved view

**Dependencies:** None (first phase)

**Done when:** Timer counts up during play, displays MM:SS format, shows final time on solve
<!-- END_PHASE_1 -->

<!-- START_PHASE_2 -->
### Phase 2: Storage Package
**Goal:** Platform-aware session persistence infrastructure

**Components:**
- `go.mod` — add `github.com/adrg/xdg` dependency
- `internal/storage/session.go` — GameSession struct, SaveSession, LoadSession, path helpers
- `internal/storage/session_test.go` — unit tests for serialization and path generation

**Dependencies:** None (can parallel with Phase 1)

**Done when:** Can save/load GameSession to/from correct platform directory, tests pass
<!-- END_PHASE_2 -->

<!-- START_PHASE_3 -->
### Phase 3: Session Restore on Startup
**Goal:** Restore partial progress when returning to an in-progress game

**Components:**
- Update in `internal/app/update.go` — after puzzle fetch, load session and restore state
- Model in `internal/app/model.go` — helper to apply session to cells

**Dependencies:** Phase 1 (timer fields), Phase 2 (storage package)

**Done when:** Closing and reopening app restores letter inputs and timer continues from saved time
<!-- END_PHASE_3 -->

<!-- START_PHASE_4 -->
### Phase 4: Save on Input
**Goal:** Persist state after each letter input

**Components:**
- Update in `internal/app/update.go` — save session after letter input and backspace
- Commands in `internal/app/commands.go` — add saveSessionCmd wrapping storage call

**Dependencies:** Phase 2 (storage package), Phase 3 (restore logic)

**Done when:** Each letter typed persists immediately, survives app restart
<!-- END_PHASE_4 -->

<!-- START_PHASE_5 -->
### Phase 5: Solved State Persistence
**Goal:** Remember solved puzzles and show completion on return

**Components:**
- Storage in `internal/storage/session.go` — add Solved bool, CompletionTime to GameSession
- Update in `internal/app/update.go` — save solved state on successful check
- View in `internal/app/view.go` — show "You solved this in X:XX" when loading solved session

**Dependencies:** Phase 4 (save infrastructure)

**Done when:** Solving puzzle saves completion; returning shows solved message with time
<!-- END_PHASE_5 -->

## Additional Considerations

**Timer precision:** Timer displays seconds but doesn't need sub-second precision. Storing `time.Duration` provides nanosecond precision for accumulated time, avoiding drift across sessions.

**Session cleanup:** Old session files could accumulate. Not addressed in this design — can add cleanup of sessions older than N days in future iteration if needed.

**Concurrent access:** Single-user TUI, no concurrent access concerns. File writes are atomic (write to temp, rename).
