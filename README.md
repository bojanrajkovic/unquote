# unquote

A cryptoquip game inspired by syndicated newspaper puzzles. Decode encrypted quotes by substituting letters — each cipher letter maps to exactly one plaintext letter.

The project has two components: a REST API that generates and validates puzzles, and a terminal UI for playing them.

## TUI

The terminal client is built with [Bubble Tea](https://github.com/charmbracelet/bubbletea) and [Lip Gloss](https://github.com/charmbracelet/lipgloss). It supports keyboard and mouse input, tracks your time, and saves progress between sessions.

### Install

Download a binary from the [latest release](https://github.com/bojanrajkovic/unquote/releases/latest), or build from source:

```bash
cd tui
go build -o unquote ./main.go
```

Binaries are available for Linux (amd64/arm64), macOS (amd64/arm64), and Windows (amd64).

### Play

```bash
./unquote
```

By default, the TUI connects to a hosted API. To use a different server:

```bash
UNQUOTE_API_URL=http://localhost:3000 ./unquote
```

### Controls

| Key | Action |
|-----|--------|
| `a`-`z` | Assign letter at cursor |
| `Backspace` / `Delete` | Clear letter at cursor |
| Arrow keys | Navigate between cells |
| `Tab` / `Shift+Tab` | Jump to next/previous word |
| `Enter` | Submit solution |
| `Ctrl+C` / `q` | Quit |

Mouse clicks on letter cells move the cursor.

## API

The API serves daily puzzles and validates solutions. Built with [Fastify](https://fastify.dev/) and TypeScript.

### Run locally

```bash
cd api
pnpm install
pnpm run build
QUOTES_FILE_PATH=../resources/quotes.json node --import ./dist/instrumentation.js dist/index.js
```

Or with Docker:

```bash
cd api
docker build -t unquote-api .
docker run -p 3000:3000 unquote-api
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/game/today` | Today's puzzle |
| `GET` | `/game/:date` | Puzzle for a specific date (YYYY-MM-DD) |
| `POST` | `/game/:id/check` | Validate a solution attempt |

## Development

The project uses [mise](https://mise.jdx.dev/) for tool management and task running.

```bash
# Install all tools (Node.js, Go, linters, etc.)
mise install

# Build everything
mise run build

# Run tests
cd api && pnpm test
cd tui && go test ./...
```

### Project structure

```
api/                    # REST API (pnpm monorepo)
  packages/api/         # Fastify server
  packages/game-generator/  # Puzzle generation library
tui/                    # Terminal UI client (Go)
  internal/app/         # Bubble Tea model and views
  internal/puzzle/      # Domain logic
  internal/ui/          # Styling and layout
```

### Commit messages

This project uses [conventional commits](https://www.conventionalcommits.org/). Commit messages are validated by commitlint via lefthook pre-commit hooks.

```
feat(tui): add dark mode support
fix(api): handle missing quotes file gracefully
```
