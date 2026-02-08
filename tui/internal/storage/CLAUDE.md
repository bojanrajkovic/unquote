# Storage

Last verified: 2026-02-08

## Purpose

Provides best-effort session persistence so players can resume puzzles across TUI restarts. Uses XDG state directory for user-specific, non-essential data that survives reboots. Uses Go 1.25's `os.OpenRoot` API to confine file operations to the sessions directory, preventing path traversal attacks.

## Contracts

- **Exposes**: `GameSession`, `SaveSession()`, `LoadSession()`, `SessionExists()`
- **Guarantees**: Atomic writes (temp file + rename). `LoadSession` returns nil, nil for missing files. Game IDs are validated to prevent path traversal.
- **Expects**: Valid game ID (alphanumeric + hyphens/underscores, no path separators). Writable XDG state directory.

## Dependencies

- **Uses**: `github.com/adrg/xdg` for XDG path resolution, Go 1.25 `os.OpenRoot` for confined file operations
- **Used by**: `app` package (session restore and save commands)
- **Boundary**: Do NOT import from other internal packages

## Key Decisions

- XDG State over Cache: Sessions are user state, not disposable cache
- Best-effort persistence: Errors are silently ignored by callers; gameplay never blocks on I/O
- JSON format: Human-readable, easy debugging, acceptable size for small session data
- Path Traversal Prevention: `os.OpenRoot` enforces kernel-level confinement; gameID validation provides defense-in-depth

## Implementation Details

- **sessionsDir()**: Returns absolute path to `~/.local/state/unquote/sessions/`, creating directory via xdg
- **sessionsRoot()**: Opens an `os.Root` handle on the sessions directory; caller must defer `Close()`
- **isValidGameID()**: Rejects gameIDs containing path separators, traversal patterns (`..`, `.`), absolute paths, or backslashes

## Invariants

- Session files stored at `~/.local/state/unquote/sessions/{gameID}.json`
- `SaveSession` always updates `SavedAt` timestamp before writing
- Writes are atomic: partial files never visible to readers
- All file operations confined to sessions directory via `os.Root` (kernel-enforced)

## Gotchas

- `LoadSession` returns nil, nil for missing files (not an error)
- Callers should treat all persistence as best-effort; ignore returned errors
- GameIDs with path separators or traversal patterns are rejected at validation time
