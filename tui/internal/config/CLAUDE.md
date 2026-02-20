# Config

Last verified: 2026-02-17

## Purpose

Provides persistent storage for player preferences and identity. Uses XDG config directory for user-specific configuration that survives reboots. Uses Go 1.25's `os.OpenRoot` API to confine file operations to the config directory, preventing path traversal attacks. Atomic writes ensure config is never partially written.

## Contracts

- **Exposes**: `Config`, `Load()`, `Save()`, `Exists()`
- **Guarantees**: Atomic writes (temp file + rename). `Load` returns `nil, nil` for missing files. All file operations confined to config directory via `os.Root` (kernel-enforced).
- **Expects**: Writable XDG config directory.

## Dependencies

- **Uses**: `github.com/adrg/xdg` for XDG path resolution, Go 1.25 `os.OpenRoot` for confined file operations
- **Used by**: `app` package (onboarding and stats preference checks)
- **Boundary**: Do NOT import from other internal packages

## Key Decisions

- XDG Config over State: Player preferences (claim code, stats opt-in) are configuration, not volatile state
- JSON format: Human-readable, easy debugging
- Path Traversal Prevention: `os.OpenRoot` enforces kernel-level confinement

## Implementation Details

- **configDir()**: Returns absolute path to `~/.config/unquote/`, creating directory via xdg probe file
- **configRoot()**: Opens an `os.Root` handle on the config directory; caller must defer `Close()`

## Invariants

- Config file stored at `~/.config/unquote/config.json`
- Writes are atomic: partial files never visible to readers
- All file operations confined to config directory via `os.Root` (kernel-enforced)

## Gotchas

- `Load` returns `nil, nil` for missing files (not an error) — callers must check for nil before dereferencing
- Tests must call `xdg.Reload()` after setting `XDG_CONFIG_HOME` to override the pre-initialized paths
