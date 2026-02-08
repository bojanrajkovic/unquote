# Security Hardening Design

## Summary

This design hardens the Unquote cryptoquip game against security vulnerabilities identified in a recent audit. The fixes span both the Go-based terminal UI and the TypeScript API server, addressing five distinct issues: path traversal via malicious game IDs, insecure HTTP connections, redirect-based response spoofing, late-failing configuration validation, and overly permissive global rate limiting.

The TUI changes prevent file system escapes by leveraging Go 1.24+'s `os.OpenRoot` API to confine session operations, block plaintext HTTP to remote hosts unless explicitly opted in via a `--insecure` flag, and disable redirect following entirely. The API changes shift quotes file validation from lazy (first request) to eager (startup), and switch rate limiting from a shared global counter to per-IP enforcement with configurable thresholds. All five fixes are independent and can be implemented in any order, with no cross-codebase dependencies.

## Definition of Done

Harden both the API and TUI against findings from a security audit. Five specific fixes:

1. **TUI: Path traversal fix** (High) — Use `os.OpenRoot` to confine session file operations to `~/.local/state/unquote/sessions/`, preventing malicious game IDs from writing/reading arbitrary `.json` files.

2. **TUI: HTTP hard error + `--insecure` flag** (Medium) — Block HTTP connections to non-localhost hosts by default. Add `--insecure` flag (stdlib `flag` package) to opt in. Keep `version` subcommand working alongside new `--version` flag.

3. **TUI: Disable HTTP redirects** (Medium) — Add `CheckRedirect` to the HTTP client to prevent redirect-based response spoofing.

4. **API: Eager quotes file validation** (Low) — Validate `QUOTES_FILE_PATH` exists and is readable at container initialization, not lazily on first request.

5. **API: Per-IP rate limiting with configurable max/window** (Medium) — Remove `global: true`, add `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW` env vars with sane defaults (100 req/min).

**Out of scope:** CORS changes, OTEL endpoint validation, file size limits, quote maxLength, error message sanitization, JSON response validation in TUI.

## Glossary

- **`os.OpenRoot`**: Go 1.24+ API that creates a sandboxed file system handle confined to a specific directory. The kernel enforces that all operations through this handle cannot access paths outside the root, even with `..` traversal attempts.
- **Path traversal**: A vulnerability where attacker-controlled input (here, game IDs) contains `..` sequences to access files outside the intended directory.
- **XDG Base Directory Specification**: A standard defining where applications should store user-specific data on Linux/Unix. The TUI follows this via `github.com/adrg/xdg`, storing session files in `~/.local/state/unquote/sessions/`.
- **`CheckRedirect`**: An `http.Client` callback in Go that intercepts redirect responses. Returning `http.ErrUseLastResponse` disables automatic redirect following.
- **Eager validation**: Loading and validating resources at application startup rather than on first use. Provides fail-fast behavior — misconfiguration crashes the process immediately rather than surfacing as a runtime error.
- **TypeBox**: A TypeScript library for runtime type validation. The API uses it to define and validate environment variable schemas via `@fastify/env`.
- **Per-IP rate limiting**: Tracking request counts separately for each client IP address, as opposed to a global shared counter that applies the same limit across all clients collectively.
- **Awilix**: A dependency injection container used by the API. Manages singleton (app-wide) and request-scoped (per-request) instances.

## Architecture

Five independent fixes across two codebases (TUI in Go, API in TypeScript). Changes are grouped by codebase but have no cross-codebase dependencies.

### TUI Changes

**Path traversal prevention** uses Go 1.24+'s `os.OpenRoot` API to confine all session file I/O to the sessions directory. Instead of constructing string paths with `filepath.Join` (which allows `..` traversal), the storage package opens an `os.Root` handle on the XDG state directory and performs all operations through it. The kernel enforces that no file access escapes the root directory, regardless of game ID contents.

**HTTP security** adds an `Options` struct threaded from `main.go` through `app.New(opts)` to `api.NewClient(insecure)`. Client construction becomes fallible — `NewClient` and `NewClientWithURL` return `(*Client, error)`. When `insecure` is false (default) and the URL uses HTTP on a non-localhost host, construction fails with a clear error. Redirect following is disabled unconditionally via `CheckRedirect` returning `http.ErrUseLastResponse`. CLI parsing uses stdlib `flag` for `--insecure` and `--version`, with the existing `version` subcommand preserved for backwards compatibility.

### API Changes

**Eager validation** makes `configureContainer()` async. After constructing `JsonQuoteSource`, it calls a new public `ensureLoaded()` method that triggers file validation and JSON schema checking at startup rather than on first request.

**Rate limiting** removes `global: true` from `@fastify/rate-limit` registration (switching from shared counter to per-IP default) and reads `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW` from config schema with sensible defaults.

## Existing Patterns

### TUI Patterns Followed

- **Constructor with testing alternative**: `New()` / `NewWithClient()` pattern preserved. `New(opts)` gains a parameter but `NewWithClient(client)` remains unchanged for test injection.
- **XDG directory conventions**: Continues using `github.com/adrg/xdg` for state directory resolution. `os.OpenRoot` wraps the resolved directory rather than replacing the XDG library.
- **Test isolation via env vars**: Tests override `XDG_STATE_HOME` with `t.Setenv()` — this pattern continues working with `os.OpenRoot` since it opens whatever directory XDG resolves to.
- **httptest-based client tests**: API client tests use `httptest.NewServer()` + `NewClientWithURL()`. This pattern extends naturally to test the new error return and insecure flag.

### API Patterns Followed

- **TypeBox config schema**: New env vars (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW`) follow the existing pattern in `src/config/schema.ts` with `Type.Number()`/`Type.String()` and defaults.
- **Test container helper**: `createTestContainer()` in `tests/helpers/` gains async signature, matching the updated `configureContainer()`.

### Divergences

- **`NewClient` return signature**: Changes from `*Client` to `(*Client, error)`. This is a breaking change to the internal API but necessary for fail-fast HTTP validation. All callers (main.go and tests) are internal.
- **`configureContainer` becomes async**: Currently sync. Change is justified by the need for async file validation at startup. The caller in `index.ts` is already in an async plugin registration context.

## Implementation Phases

<!-- START_PHASE_1 -->
### Phase 1: TUI Path Traversal Fix

**Goal:** Confine session file operations to the sessions directory using `os.OpenRoot`.

**Components:**
- `tui/internal/storage/session.go` — Replace `sessionPath()` with `sessionsRoot()` returning `*os.Root`. Refactor `SaveSession`, `LoadSession`, `SessionExists` to use `root.ReadFile()`, `root.WriteFile()`, `root.Rename()`, `root.Remove()`, `root.Stat()`. Use `root.MkdirAll()` for directory creation within the root.
- `tui/internal/storage/session_test.go` — Update tests for new API. Add test verifying path traversal game IDs (e.g., `../../evil`) are rejected by `os.Root`.

**Dependencies:** None (first phase)

**Done when:** Session save/load works as before, path traversal game IDs return errors, all storage tests pass.
<!-- END_PHASE_1 -->

<!-- START_PHASE_2 -->
### Phase 2: TUI CLI Flag Parsing

**Goal:** Add stdlib `flag` parsing with `--insecure` and `--version` flags, preserving `version` subcommand.

**Components:**
- `tui/internal/app/model.go` — Add `Options` struct with `Insecure bool`. Change `New()` to `New(opts Options)`.
- `tui/main.go` — Add `flag.Bool("insecure", ...)` and `flag.Bool("version", ...)`. Check for `version` subcommand before `flag.Parse()`. Pass `Options` to `app.New()`.

**Dependencies:** None (independent of Phase 1)

**Done when:** `unquote --version` and `unquote version` both print version info. `--insecure` flag is parsed and threaded to `app.New()`. `unquote --help` shows available flags. Build succeeds.
<!-- END_PHASE_2 -->

<!-- START_PHASE_3 -->
### Phase 3: TUI HTTP Hard Error and Redirect Limiting

**Goal:** Block insecure HTTP by default, disable redirects, thread `--insecure` flag to API client.

**Components:**
- `tui/internal/api/client.go` — Change `NewClient()` and `NewClientWithURL()` to accept `insecure bool` and return `(*Client, error)`. When `insecure` is false and URL is HTTP to non-localhost, return error. Add `CheckRedirect` returning `http.ErrUseLastResponse` to all clients. When `insecure` is true, skip HTTP validation (allow plaintext).
- `tui/internal/app/model.go` — `New(opts Options)` passes `opts.Insecure` to `api.NewClient()`, handles returned error.
- `tui/main.go` — Handle error from `app.New()` by printing to stderr and exiting.
- `tui/internal/api/client_test.go` — Tests for: insecure HTTP rejected by default, insecure HTTP allowed with flag, redirects not followed, HTTPS works without flag.

**Dependencies:** Phase 2 (flag parsing and Options struct)

**Done when:** HTTP to non-localhost fails without `--insecure`, succeeds with it. Redirects are not followed. All client tests pass.
<!-- END_PHASE_3 -->

<!-- START_PHASE_4 -->
### Phase 4: API Eager Quotes File Validation

**Goal:** Validate QUOTES_FILE_PATH at startup instead of on first request.

**Components:**
- `api/packages/game-generator/src/quotes/json-source.ts` — Add public `ensureLoaded()` method that calls existing private `loadQuotes()`. This validates file existence, readability, and JSON schema.
- `api/packages/api/src/deps/singleton.ts` — Make `configureContainer()` async. After constructing `JsonQuoteSource`, await `ensureLoaded()`.
- `api/packages/api/src/deps/plugin.ts` — Update caller to await async `configureContainer()`.
- `api/packages/api/tests/helpers/test-container.ts` — Make `createTestContainer()` async. Update `defaultTestConfig` if needed.
- `api/packages/api/tests/deps/singleton.test.ts` — Update tests for async container creation.
- `api/packages/game-generator/src/quotes/json-source.test.ts` — Add test for `ensureLoaded()` with valid and invalid files.

**Dependencies:** None (independent of TUI phases)

**Done when:** Server crashes at startup with clear error if QUOTES_FILE_PATH is missing/invalid. All existing tests pass with async container.
<!-- END_PHASE_4 -->

<!-- START_PHASE_5 -->
### Phase 5: API Per-IP Rate Limiting with Configurable Max/Window

**Goal:** Switch from global shared counter to per-IP rate limiting with configurable env vars.

**Components:**
- `api/packages/api/src/config/schema.ts` — Add `RATE_LIMIT_MAX` (`Type.Number`, default 100, minimum 1) and `RATE_LIMIT_WINDOW` (`Type.String`, default `"1 minute"`).
- `api/packages/api/src/index.ts` — Remove `global: true` from `rateLimit` registration. Use `fastify.config.RATE_LIMIT_MAX` and `fastify.config.RATE_LIMIT_WINDOW`.
- `api/packages/api/tests/helpers/test-container.ts` — Add rate limit defaults to `defaultTestConfig`.

**Dependencies:** None (independent of other phases)

**Done when:** Rate limiting applies per-IP. Config accepts custom max/window via env vars. Defaults remain 100 req/min. Existing tests pass.
<!-- END_PHASE_5 -->

## Additional Considerations

**`os.Root` lifecycle**: Each storage operation opens and closes an `os.Root` handle. This is intentional — session persistence is best-effort and infrequent (on input changes and solve), so the overhead of repeated open/close is negligible compared to the file I/O itself. Holding a long-lived `os.Root` handle would add lifecycle management complexity for no practical benefit.

**`--insecure` does NOT disable TLS verification**: The flag only allows plaintext HTTP to non-localhost hosts. It does not set `InsecureSkipVerify` on the TLS transport. Users who need to skip TLS verification (e.g., self-signed certs) can use `UNQUOTE_API_URL` with HTTP — the `--insecure` flag permits that. Actual TLS certificate issues should be resolved at the OS level (adding CA certs).
