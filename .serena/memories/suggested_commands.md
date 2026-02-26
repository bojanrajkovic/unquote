# Suggested Commands

## Global (from project root via mise)

```bash
# Build everything
mise run build

# Build specific component
mise run //api:build
mise run //tui:build
mise run //web:build
```

## API Development (from `api/` directory)

```bash
pnpm run build          # Build all packages
pnpm run test           # Run tests (vitest)
pnpm run lint           # Lint with oxlint
pnpm run format         # Format with oxfmt
pnpm run typecheck      # TypeScript type checking
```

## TUI Development

From project root (preferred):
```bash
mise run //tui:build    # Build binary with version info
mise run //tui:fmt      # Format with gofumpt
mise run //tui:vet      # Run go vet
mise run //tui:lint     # Run golangci-lint
mise run //tui:test     # Run tests with race detector
mise run //tui:ci       # All of the above in order
```

## Web Development (from `web/` directory)

```bash
pnpm run dev            # Start SvelteKit dev server
pnpm run build          # Build static site
pnpm run test           # Run tests (vitest)
pnpm run check          # Svelte type checking (svelte-check)
pnpm run format         # Format with Prettier
```

## Running the Application

```bash
# API server (from api/packages/api/)
pnpm start
# Requires: QUOTES_FILE_PATH environment variable
# Optional: DATABASE_URL for player stats

# TUI client (from tui/)
./bin/unquote
# Optional: UNQUOTE_API_URL (default: https://unquote.gaur-kardashev.ts.net)
```

## Git

```bash
# Worktrees (used for feature branches)
git worktree add /tmp/unquote-<name> -b <branch-name>
mise trust /tmp/unquote-<name>   # Required for lefthook hooks
git worktree remove /tmp/unquote-<name>
git worktree list
```
