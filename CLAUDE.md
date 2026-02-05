# Unquote

Last verified: 2026-02-04

A cryptoquip game inspired by syndicated newspaper puzzles. Players decode encrypted quotes by substituting letters.

## Tech Stack

- **API**: Node.js 24+ / Fastify 5 / TypeScript (pnpm 10 monorepo)
- **TUI**: Go 1.25.6
- **Version management & tasks**: mise

## Commands

### Build
- `mise run build` - Build all projects
- `mise run //api:build` - Build the API
- `mise run //tui:build` - Build the TUI

### API Development (run from `api/`)
- `pnpm run build` - Build all packages
- `pnpm run test` - Run tests (vitest)
- `pnpm run lint` - Lint with oxlint
- `pnpm run format` - Format with oxfmt
- `pnpm run typecheck` - TypeScript type checking

## Project Structure

- `api/` - REST API (pnpm monorepo with `packages/`)
  - `packages/api/` - Main API server
  - `packages/game-generator/` - Puzzle generation library
- `tui/` - Terminal UI client (Go module)

## API Architecture

- **Framework**: Fastify with TypeBox type provider
- **Documentation**: OpenAPI 3 via `@eropple/fastify-openapi3`
- **Security**: helmet, cors, rate limiting (100 req/min), under-pressure
- **Configuration**: `@fastify/env` with TypeBox schema validation (fail-fast on missing required vars)
- **DI**: Awilix with singleton + request scopes (see `src/deps/CLAUDE.md`)
- **Observability**: OpenTelemetry auto-instrumentation (traces, Pino log correlation)
- **Port**: 3000 (default, configurable via PORT env var)

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3000 | Server port |
| `HOST` | No | 0.0.0.0 | Server host |
| `LOG_LEVEL` | No | info | Pino log level |
| `QUOTES_FILE_PATH` | Yes | - | Path to quotes JSON file |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | - | OpenTelemetry collector endpoint |

### Testing

- **Test containers**: Use `createTestContainer()` from `tests/helpers/` with mock defaults
- **Override pattern**: Pass partial options to replace specific dependencies

### Endpoints

- `GET /game/today` - Retrieve today's cryptoquip puzzle
- `GET /game/:date` - Retrieve puzzle for a specific date (ISO format: YYYY-MM-DD)
- `POST /game/:id/check` - Validate a solution attempt using opaque game ID

## TUI Architecture

- **Framework**: Bubble Tea (Elm architecture for Go)
- **Styling**: Lip Gloss
- **Configuration**: `UNQUOTE_API_URL` env var (default: `http://localhost:3000`)

### TUI Development (run from `tui/`)
- `go build -o bin/unquote ./main.go` - Build binary
- `go test ./...` - Run all tests

### Package Structure
- `internal/api/` - API client for REST communication
- `internal/app/` - Bubble Tea model, update loop, and views
- `internal/puzzle/` - Domain logic (cells, navigation, solution assembly)
- `internal/ui/` - Styling and text wrapping utilities

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

### Format

```
<type>(<scope>): <description>
```

### Types

- `feat` - New user-facing feature
- `fix` - User-facing bug fix
- `docs` - Documentation only
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `test` - Adding or correcting tests
- `build` - Build system or external dependencies
- `perf` - Performance improvement
- `ci` - CI configuration
- `chore` - Other changes that don't modify src or test files

### Scopes

- `api` - API server changes
- `game-generator` - Puzzle generation library changes
- `tui` - TUI changes

### Guidelines

- Describe WHAT changed and WHY, not HOW
- Use imperative mood ("add" not "added")
- Keep first line under 72 characters

### Examples

```
feat(api): add endpoint to retrieve daily puzzle
fix(tui): correct letter substitution display on narrow terminals
build(api): upgrade express to v5
build(tui): pin Go version to 1.25.6
```
