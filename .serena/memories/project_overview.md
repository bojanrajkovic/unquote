# Unquote - Project Overview

A cryptoquip game inspired by syndicated newspaper puzzles. Players decode encrypted quotes by substituting letters.

## Architecture

**Dual-component system:**
- **API** (Node.js/TypeScript): REST API serving daily puzzles and validating solutions
- **TUI** (Go): Terminal UI client for playing puzzles

## Tech Stack

### API
- Node.js 24+ / Fastify 5 / TypeScript
- pnpm 10 monorepo with packages:
  - `packages/api/` - Main API server
  - `packages/game-generator/` - Puzzle generation library
- DI via Awilix (singleton + request scopes)
- OpenAPI 3 documentation
- TypeBox for schema validation
- Vitest for testing, fast-check for property-based tests

### TUI
- Go 1.25.6
- Bubble Tea (Elm architecture)
- Lip Gloss (terminal styling)

### Build Tools
- Version management & task runner: mise (`mise.toml`)
- Containerization: Docker (multi-stage build in `api/Dockerfile`)
- Registry: GitHub Container Registry (GHCR)
- Deployment: Kubernetes with Tailscale Funnel ingress

## Project Structure

```
unquote/
├── api/                          # Node.js API monorepo
│   ├── Dockerfile                # Multi-stage Docker build
│   ├── packages/
│   │   ├── api/                  # Main API server
│   │   └── game-generator/       # Puzzle generation library
│   └── resources/quotes.json     # Shared quote data
├── tui/                          # Go TUI client
│   └── internal/
│       ├── api/                  # API client
│       ├── app/                  # Bubble Tea model/views
│       ├── puzzle/               # Domain logic
│       ├── storage/              # Session persistence
│       ├── ui/                   # Styling utilities
│       └── version/              # Build-time version info
├── docs/design-plans/            # Design documentation
├── mise.toml                     # Task runner & version config
├── renovate.json                 # Dependency update config
└── CLAUDE.md                     # Project conventions
```

## API Endpoints

- `GET /health` - Health check
- `GET /game/today` - Get today's cryptoquip puzzle
- `GET /game/:date` - Get puzzle for specific date (YYYY-MM-DD)
- `POST /game/:id/check` - Validate solution attempt

## Key Design Decisions

- **Deterministic puzzles**: Same date always produces same puzzle
- **Keyword cipher**: Uses memorable keywords for substitution
- **Elm architecture**: Bubble Tea ensures predictable TUI state management
- **Internal packages**: Go packages under `internal/` prevent external imports
- **Multi-platform Docker**: linux/amd64 and linux/arm64 via native runners
