# Unquote - Project Overview

A cryptoquip game inspired by syndicated newspaper puzzles. Players decode encrypted quotes by substituting letters.

## Architecture

**Three-component system:**
- **API** (Node.js/TypeScript): REST API serving daily puzzles, validating solutions, and tracking player stats
- **TUI** (Go): Terminal UI client for playing puzzles
- **Web** (SvelteKit): Static SPA web frontend

## Tech Stack

### API
- Node.js 24+ / Fastify 5 / TypeScript
- pnpm 10 monorepo with packages:
  - `packages/api/` - Main API server
  - `packages/game-generator/` - Puzzle generation library
- DI via Awilix (singleton + request scopes)
- OpenAPI 3 documentation
- TypeBox for schema validation (import from `"typebox"`, not `"@sinclair/typebox"`)
- PostgreSQL via Drizzle ORM + node-postgres (optional, for player stats)
- Vitest for testing, fast-check for property-based tests

### Observability
- OpenTelemetry traces (auto-instrumentation for HTTP, Fastify, pg, Drizzle + manual spans)
- OpenTelemetry metrics (V8 heap, GC, event loop via runtime-node instrumentation)
- Exponential (native) histogram aggregation for all histogram instruments
- Pino logging with trace correlation
- Instrumentation entrypoint: `src/instrumentation.ts` (loaded via `--import`)

### TUI
- Go 1.25.6
- Bubble Tea (Elm architecture)
- Lip Gloss (terminal styling)

### Web
- SvelteKit 5 / Svelte 5 / Tailwind v4 / TypeScript
- Static SPA via adapter-static
- S3 + CloudFront hosting (Terraform-managed in `infra/web/`)

### Build Tools
- Version management & task runner: mise (`mise.toml`)
- Containerization: Docker (multi-stage build in `api/Dockerfile`)
- Registry: GitHub Container Registry (GHCR)
- Deployment: Kubernetes

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
│       └── versioninfo/          # Build-time version info
├── web/                          # SvelteKit static SPA
├── infra/web/                    # Terraform for S3+CloudFront hosting
├── k8s/                          # Kubernetes manifests
├── docs/design-plans/            # Design documentation
├── mise.toml                     # Task runner & version config
└── CLAUDE.md                     # Project conventions
```

## API Endpoints

- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe (reports database status)
- `GET /game/today` - Get today's cryptoquip puzzle
- `GET /game/:date` - Get puzzle for specific date (YYYY-MM-DD)
- `POST /game/:id/check` - Validate solution attempt
- `POST /player` - Register a new player (returns claim code)
- `POST /player/:code/session` - Record a game session
- `POST /player/:code/session/:gameId` - Record a game session (game ID in URL)
- `GET /player/:code/session/:gameId` - Look up a player's session
- `GET /player/:code/stats` - Retrieve player statistics

## Key Design Decisions

- **Deterministic puzzles**: Same date always produces same puzzle
- **Keyword cipher**: Uses memorable keywords for substitution
- **Elm architecture**: Bubble Tea ensures predictable TUI state management
- **Internal packages**: Go packages under `internal/` prevent external imports
- **Multi-platform Docker**: linux/amd64 and linux/arm64 via native runners
- **Optional database**: Player stats enabled when `DATABASE_URL` is set, gracefully degrades without it
- **Exponential histograms**: OTel SDK configured for native histogram aggregation (requires Prometheus native histogram support)
