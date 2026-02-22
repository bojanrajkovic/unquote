# Unquote

Last verified: 2026-02-22

A cryptoquip game inspired by syndicated newspaper puzzles. Players decode encrypted quotes by substituting letters.

For detailed architecture, module guide, data flows, and navigation guide, see [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md).

## Tech Stack

- **API**: Node.js 24+ / Fastify 5 / TypeScript (pnpm 10 monorepo)
- **Web**: SvelteKit 5 / Svelte 5 / Tailwind v4 / TypeScript (static SPA)
- **Database**: PostgreSQL via Drizzle ORM + node-postgres (optional, for player stats)
- **TUI**: Go 1.25.6
- **Version management & tasks**: mise

## Commands

### Build
- `mise run build` - Build all projects
- `mise run //api:build` - Build the API
- `mise run //tui:build` - Build the TUI
- `mise run //web:build` - Build the web frontend

### Web Development (run from `web/`)
- `pnpm run dev` - Start SvelteKit dev server
- `pnpm run build` - Build static site
- `pnpm run test` - Run tests (vitest)
- `pnpm run check` - Svelte type checking (svelte-check)
- `pnpm run format` - Format with Prettier

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
- `web/` - Web frontend (SvelteKit static SPA, pnpm workspace member)
- `tui/` - Terminal UI client (Go module)
- `infra/web/` - Terraform for web hosting (S3 + CloudFront + GitHub OIDC deploy role)

## Containerization

- **Dockerfile**: `api/Dockerfile` -- multi-stage build (base, build, production)
- **Registry**: GitHub Container Registry (GHCR) via `api-docker.yml` workflow
- **Platforms**: linux/amd64 and linux/arm64 (native runners, no QEMU)
- **Deploy strategy**: `pnpm deploy --filter=@unquote/api --prod` for minimal production image
- **Workspace injection**: `injectWorkspacePackages: true` in pnpm-workspace.yaml (required for `pnpm deploy`)

## Web Hosting

- **Hosting**: S3 static site + CloudFront CDN (Terraform-managed in `infra/web/`)
- **Deploy**: GitHub Actions (`web-deploy.yml`) via OIDC role assumption (no long-lived credentials)
- **Trigger**: Push to `main` when `web/**` changes
- **Build output**: Static HTML/JS/CSS via SvelteKit `adapter-static`
- **Cache strategy**: Immutable assets (1 year), HTML (must-revalidate) + CloudFront invalidation on deploy

## API Architecture

- **Framework**: Fastify with TypeBox type provider
- **Documentation**: OpenAPI 3 via `@eropple/fastify-openapi3`
- **Security**: helmet, cors, rate limiting (per-IP, configurable via env vars), under-pressure
- **Configuration**: `@fastify/env` with TypeBox schema validation (fail-fast on missing required vars)
- **DI**: Awilix with singleton + request scopes (see `src/deps/CLAUDE.md`)
- **Database**: Drizzle ORM with node-postgres; optional (enabled when `DATABASE_URL` is set). Migrations via `drizzle-kit` with advisory lock for concurrent safety.
- **Observability**: OpenTelemetry traces (auto-instrumentation for HTTP, Fastify, pg, Drizzle + manual spans via `tracedProxy` and game-generator's `@traced`/`withSpan`), Pino log correlation
- **Port**: 3000 (default, configurable via PORT env var)

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3000 | Server port |
| `HOST` | No | 0.0.0.0 | Server host |
| `LOG_LEVEL` | No | info | Pino log level |
| `QUOTES_FILE_PATH` | Yes | - | Path to quotes JSON file |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | - | OpenTelemetry collector endpoint |
| `DATABASE_URL` | No | - | PostgreSQL connection string for player stats |
| `RATE_LIMIT_MAX` | No | 100 | Max requests per window per IP |
| `RATE_LIMIT_WINDOW` | No | 1 minute | Rate limit time window |

### Testing

- **Test containers**: Use `createTestContainer()` from `tests/helpers/` with mock defaults
- **Override pattern**: Pass partial options to replace specific dependencies

### Endpoints

- `GET /health/live` - Liveness probe (returns `{ status: "ok" }`)
- `GET /health/ready` - Readiness probe (reports database connectivity status)
- `GET /game/today` - Retrieve today's cryptoquip puzzle
- `GET /game/:date` - Retrieve puzzle for a specific date (ISO format: YYYY-MM-DD)
- `POST /game/:id/check` - Validate a solution attempt using opaque game ID
- `POST /player` - Register a new player (returns claim code)
- `POST /player/:code/session` - Record a game session for a player
- `GET /player/:code/stats` - Retrieve player statistics

## TUI Architecture

- **Framework**: Bubble Tea (Elm architecture for Go)
- **CLI**: Cobra (subcommands: `version`, `register`, `link`, `claim-code`, `stats`)
- **Styling**: Lip Gloss
- **Forms**: huh (interactive onboarding)
- **Configuration**: `UNQUOTE_API_URL` env var (default: `https://unquote.gaur-kardashev.ts.net`)

### TUI Development (run from `tui/`)
- `go build -o bin/unquote ./main.go` - Build binary
- `go test ./...` - Run all tests

### Package Structure
- `cmd/` - Cobra CLI commands (root, version, register, link, claim-code, stats)
- `internal/api/` - API client for REST communication (game + player endpoints)
- `internal/app/` - Bubble Tea model, update loop, and views
- `internal/config/` - Player config persistence (claim code, stats preference; XDG config directory)
- `internal/puzzle/` - Domain logic (cells, navigation, solution assembly)
- `internal/storage/` - Session persistence (XDG state directory)
- `internal/ui/` - Styling and text wrapping utilities
- `internal/versioninfo/` - Build-time version info (ldflags injection)

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

- `api` - API server changes (subscopes allowed, e.g. `api/routes`)
- `game-generator` - Puzzle generation library changes
- `web` - Web frontend changes (subscopes allowed, e.g. `web/state`)
- `tui` - TUI changes (subscopes allowed, e.g. `tui/app`)
- `infra` - Infrastructure changes (subscopes allowed, e.g. `infra/web`)
- `ci` - CI/CD workflow changes

### Guidelines

- Describe WHAT changed and WHY, not HOW
- Use imperative mood ("add" not "added")
- Keep first line under 72 characters
- **TUI commits must use the `tui` scope** (or a subscope like `tui/app`). The TUI release changelog filters by `(tui` prefix to exclude unrelated commits.

### Examples

```
feat(api): add endpoint to retrieve daily puzzle
fix(tui): correct letter substitution display on narrow terminals
build(api): upgrade express to v5
build(tui): pin Go version to 1.25.6
```
