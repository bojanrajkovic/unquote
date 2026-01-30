# Unquote

Last verified: 2026-01-28

A cryptoquip game inspired by syndicated newspaper puzzles. Players decode encrypted quotes by substituting letters.

## Tech Stack

- **API**: Node.js 24+ / Fastify 5 / TypeScript (pnpm 10 monorepo)
- **TUI**: Go 1.25.6
- **Task runner**: Task (via mise)
- **Version management**: mise

## Commands

### Build
- `task build` - Build all projects
- `task build:api` - Build the API
- `task build:tui` - Build the TUI

### API Development (run from `api/`)
- `pnpm run build` - Build all packages
- `pnpm run test` - Run tests (vitest)
- `pnpm run lint` - Lint with oxlint
- `pnpm run format` - Format with oxfmt
- `pnpm run typecheck` - TypeScript type checking

## Project Structure

- `api/` - REST API (pnpm monorepo with `packages/`)
  - `packages/api/` - Main API server
- `tui/` - Terminal UI client (Go module)

## API Architecture

- **Framework**: Fastify with TypeBox type provider
- **Documentation**: OpenAPI 3 via `@eropple/fastify-openapi3`
- **Security**: helmet, cors, rate limiting (100 req/min), under-pressure
- **Port**: 3000

### Endpoints (Planned)

- `GET /game/today` - Retrieve the cryptoquip of the day
- `POST /game/check` - Validate a solution attempt

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

- `api` - API changes
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
