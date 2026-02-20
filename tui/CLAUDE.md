# TUI

Last verified: 2026-02-17

Terminal UI client for playing cryptoquip puzzles.

## Tech Stack

- **Framework**: Bubble Tea (Elm architecture for Go)
- **CLI**: Cobra (subcommand-based CLI)
- **Styling**: Lip Gloss
- **Forms**: huh (interactive onboarding prompts)
- **Graphs**: asciigraph (stats visualization)
- **Mouse zones**: bubblezone (click detection)
- **Language**: Go 1.25.6

## Commands

From `tui/` directory:
- `go build -o bin/unquote ./main.go` - Build binary
- `go test ./...` - Run all tests

## Package Structure

- `cmd/` - Cobra CLI commands (root, version, register, link, claim-code, stats)
- `internal/api/` - API client for REST communication (game + player endpoints)
- `internal/app/` - Bubble Tea model, update loop, and views
- `internal/config/` - Player config persistence (claim code, stats preference; XDG config directory)
- `internal/puzzle/` - Domain logic (cells, navigation, solution assembly)
- `internal/storage/` - Session persistence (XDG state directory)
- `internal/ui/` - Styling and text wrapping utilities
- `internal/version/` - Build-time version info (ldflags injection)

## Contracts

### cmd package
- **Exposes**: `NewRootCmd() *cobra.Command`, `Execute() error`
- **Subcommands**: `version`, `register`, `link`, `claim-code`, `stats`
- **Persistent flags**: `--insecure` (allow HTTP to non-localhost), `--random` (random puzzle)
- **Guarantees**: Constructor-based (`NewRootCmd()`) to avoid state accumulation between tests

### api package
- **Exposes**: `Client`, `NewClient(insecure bool) (*Client, error)`, `NewClientWithURL(url string, insecure bool) (*Client, error)`
- **Game methods**: `FetchTodaysPuzzle()`, `FetchPuzzleByDate(date)`, `FetchRandomPuzzle()`, `CheckSolution(gameID, solution)`
- **Player methods**: `RegisterPlayer()`, `RecordSession(claimCode, gameID, completionTimeMs)`, `FetchStats(claimCode)`
- **Guarantees**: Wraps all API errors with context. Rejects HTTP to non-localhost unless insecure=true. Blocks HTTP redirects unconditionally.
- **Expects**: API at `UNQUOTE_API_URL` env var (default: `https://unquote.gaur-kardashev.ts.net`)

### config package
- **Exposes**: `Config`, `Load()`, `Save()`, `Exists()`
- **Guarantees**: Atomic writes (temp file + rename). `Load` returns `nil, nil` for missing files. All file operations confined to config directory via `os.Root` (kernel-enforced).
- **Expects**: Writable XDG config directory (`~/.config/unquote/config.json`)

### puzzle package
- **Exposes**: `Cell`, `CellKind` (`CellPunctuation`, `CellLetter`, `CellHint`), `BuildCells(text, hints)`, cell navigation functions, `AssembleSolution()`, `SetInput()`, `ClearAllInput()`
- **Guarantees**: Navigation functions return -1 when no valid cell exists. `SetInput()` rejects non-`CellLetter` cells (returns false). `ClearAllInput()` preserves hint cell input.
- **Invariants**: `Cell.Kind` distinguishes `CellPunctuation` (not editable), `CellLetter` (editable by player), and `CellHint` (prefilled, locked). Navigation functions only traverse `CellLetter` cells, skipping both punctuation and hints.

### app package
- **Exposes**: `Model`, `Options`, `New(opts Options)`, `NewWithClient(client)` for testing
- **States**: Loading -> Playing -> (Checking -> Playing | Solved) or Error; also Onboarding, ClaimCodeDisplay, Stats
- **Timer**: `Model.Elapsed()` returns total time; timer runs while Playing, pauses on Solved/Checking
- **Persistence**: Session auto-restored on startup; auto-saved on input changes and solve
- **Mouse**: Left-click on letter cells navigates cursor; non-letter cells ignore clicks
- **Onboarding**: Shown on first launch if no config exists; uses huh forms for register/skip choice
- **Session recording**: On solve, uploads session to API if player is registered; reconciles un-uploaded sessions on startup
- **Stats screen**: Accessible from solved screen (Tab key) or via `stats` subcommand; shows graph + sidebar
- **Invariants**: Terminal size validated before rendering; minimum 40x10
- **Options**: `Insecure` (allow HTTP), `Random` (random puzzle), `StatsMode` (launch directly to stats screen)

### storage package
- **Exposes**: `GameSession`, `SaveSession()`, `LoadSession()`, `SessionExists()`, `ListSolvedSessions()`
- **Guarantees**: Atomic writes; missing files return nil (not error)
- **GameSession fields**: `Inputs`, `GameID`, `ElapsedTime`, `CompletionTime`, `Solved`, `Uploaded`
- **Best-effort**: All persistence is non-blocking; errors silently ignored

### ui package
- **Exposes**: Style definitions (colors, cell styles including `HintCellStyle`), text wrapping functions: `WordWrapText()`, `GroupCellsByWord()`, `WrapWordGroups()`, `FlattenLine()`
- **Guarantees**: Consistent color palette across all UI states; word-aware line breaking respects cell boundaries. Hint cells render with cyan foreground (`ColorSecondary`) to visually match clue text.

### version package
- **Exposes**: `Info` struct, `Get()`, `Version` and `Branch` vars (ldflags targets)
- **Guarantees**: `Get()` always returns valid Info (defaults to "dev" if no ldflags); commit hash truncated to 12 chars
- **Build integration**: Set via `-ldflags "-X ...Version=v1.0.0"` at compile time; goreleaser handles this automatically

## Key Decisions

- **Bubble Tea**: Elm architecture ensures predictable state management
- **Internal packages**: All packages under `internal/` prevent external imports
- **NewWithClient**: Enables testing without live API

## Anti-Patterns (Do NOT Add)

- Functional Core/Imperative Shell comments - the pattern is implicit, do not document in code

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `UNQUOTE_API_URL` | No | https://unquote.gaur-kardashev.ts.net | API base URL |

## CI/CD Workflows

### PR Workflow (tui-pr.yml)

Triggered automatically when you open a PR that modifies files in `tui/` or `.github/workflows/tui-*.yml`.

**Validation** (blocking):
1. **Validate PR Title** - Checks PR title follows conventional commit format
   - Valid: `feat(tui): add dark mode`, `fix(tui): correct alignment`, `docs(tui): update readme`
   - Invalid: `Add dark mode`, `tui: add feature` (missing type prefix)
   - Blocks merge if title is invalid

2. **CI Checks** - Executes `mise run ci` (fmt, vet, lint, test, build)
   - Blocks merge if any check fails

3. **Build Snapshot** - Runs after CI passes
   - Calculates alpha version from commit history
   - Builds cross-platform binaries via goreleaser (Linux amd64/arm64, macOS universal, Windows amd64)
   - Uploads artifacts to GitHub Actions (7-day retention)
   - Posts/updates PR comment with download links

### Release Workflow (tui-release.yml)

Triggered automatically when you merge a PR to `main` that modifies files in `tui/` or `.github/workflows/tui-*.yml`.

**Release Decision**:
1. **Check if Release Needed** - Examines the merge commit message
   - Only proceeds if commit starts with `feat:` or `fix:` (with colon)
   - Skips release for `docs:`, `chore:`, `refactor:`, `test:`, etc.

2. **CI Checks** (if release needed) - Same checks as PR workflow

3. **Create Release** (if CI passes):
   - Calculates next semantic version (e.g., v0.1.0 → v0.1.1 for fix, v0.2.0 for feat)
   - Creates and pushes git tag (e.g., v0.1.1)
   - Runs goreleaser to build and publish GitHub Release with downloadable binaries for all platforms

### Troubleshooting

**PR workflow doesn't trigger:**
- Check `paths:` filter in tui-pr.yml matches changed files (must be in `tui/` or `.github/workflows/tui-*.yml`)
- Verify tui-pr.yml exists on the target branch
- Verify PR is set to merge into the target branch

**Release workflow doesn't trigger:**
- Check commit message starts with `feat:` or `fix:` (with colon) - not `feat` or `fix` alone
- Verify `paths:` filter matches changed files in `tui/`
- Verify workflow permissions include `contents: write`

**GoReleaser fails:**
- Run `goreleaser check` locally in `tui/` to validate .goreleaser.yml
- Check if tag already exists (goreleaser won't overwrite)
- Verify GITHUB_TOKEN has write access to repository
