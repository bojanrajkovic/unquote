# Storage

Last verified: 2026-02-04

## Purpose

Provides best-effort session persistence so players can resume puzzles across TUI restarts. Uses XDG state directory for user-specific, non-essential data that survives reboots.

## Contracts

- **Exposes**: `GameSession`, `SaveSession()`, `LoadSession()`, `SessionExists()`
- **Guarantees**: Atomic writes (temp file + rename). `LoadSession` returns nil, nil for missing files.
- **Expects**: Valid game ID (non-empty string). Writable XDG state directory.

## Dependencies

- **Uses**: `github.com/adrg/xdg` for XDG path resolution
- **Used by**: `app` package (session restore and save commands)
- **Boundary**: Do NOT import from other internal packages

## Key Decisions

- XDG State over Cache: Sessions are user state, not disposable cache
- Best-effort persistence: Errors are silently ignored by callers; gameplay never blocks on I/O
- JSON format: Human-readable, easy debugging, acceptable size for small session data

## Invariants

- Session files stored at `~/.local/state/unquote/sessions/{gameID}.json`
- `SaveSession` always updates `SavedAt` timestamp before writing
- Writes are atomic: partial files never visible to readers

## Gotchas

- `LoadSession` returns nil, nil for missing files (not an error)
- Callers should treat all persistence as best-effort; ignore returned errors
