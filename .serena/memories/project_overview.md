# Unquote Project Overview

## Purpose
A cryptoquip game inspired by syndicated newspaper puzzles where players decode encrypted quotes by substituting letters.

## Tech Stack
- **API**: Node.js (pnpm) - Fastify web framework with TypeScript
- **TUI**: Go (not yet implemented)
- **Task runner**: Task (via mise)
- **Version management**: mise
- **Linter**: oxlint with typescript, import, unicorn, promise plugins

## Project Structure
- `api/` - Node.js monorepo root
  - `packages/api/` - @unquote/api package with Fastify server
    - `src/index.ts` - Entry point
    - `dist/` - Compiled JavaScript (generated)
- `tui/` - Terminal UI client (planned)

## Key Commands
- `task build` - Build all projects
- `task build:api` - Build the API
- `cd api && pnpm install` - Install dependencies
- `cd api && pnpm build` - Build API package
- `cd api && pnpm --filter @unquote/api dev` - Run API dev server on port 3000

## Code Style
- TypeScript with strict config
- Conventional Commits for messages
- Functional Core / Imperative Shell (FCIS) pattern
- ES2024 target
- Import ordering: builtin → external → internal → parent → sibling → index
