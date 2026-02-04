# Suggested Commands

## Global (from project root)

```bash
# Build everything
task build

# Build specific component
task build:api
task build:tui
```

## API Development (from `api/` directory)

```bash
# Build all packages
pnpm run build

# Run tests (vitest)
pnpm run test

# Lint with oxlint
pnpm run lint

# Format with oxfmt
pnpm run format
pnpm run format:check   # Check only, don't fix

# TypeScript type checking
pnpm run typecheck
```

## TUI Development (from `tui/` directory)

```bash
# Build binary
go build -o bin/unquote ./main.go

# Run all tests
go test ./...

# Run with verbose output
go test -v ./...

# Run specific package tests
go test ./internal/app/...
```

## Running the Application

```bash
# API server (from api/packages/api/)
pnpm start
# Requires: QUOTES_FILE_PATH environment variable

# TUI client (from tui/)
./bin/unquote
# Optional: UNQUOTE_API_URL (default: http://localhost:3000)
```

## Git

```bash
# Standard git commands
git status
git diff
git add <file>
git commit -m "type(scope): description"
git log --oneline

# Worktrees (used for feature branches)
git worktree add ../.worktrees/<name> -b <branch-name>
git worktree remove ../.worktrees/<name>
git worktree list
```

## System Utilities

```bash
ls -la          # List files with details
find . -name "*.go"   # Find files
grep -r "pattern" .   # Search in files
cat <file>      # View file contents
head -n 20 <file>     # View first 20 lines
tail -n 20 <file>     # View last 20 lines
```
