# API and TUI Project Scaffold Design

## Summary

This design establishes the foundational project structure for Unquote, consisting of two independent applications: a Fastify-based API server and a Go terminal user interface (TUI). The API is organized as a pnpm monorepo workspace using TypeScript with maximum strictness enabled, while the TUI is a standalone Go module that will eventually provide interactive CLI functionality. Both projects share a common root directory orchestrated by a Taskfile that enables coordinated builds across the entire codebase.

The implementation leverages established tooling patterns already present in the project (mise for version management, Task for build orchestration, Conventional Commits for version control). The API scaffold includes comprehensive tooling (Oxlint for linting, Oxfmt for formatting, Vitest for testing) and production-ready Fastify plugins (helmet for security, CORS support, rate limiting, health checks). The initial implementation provides minimal "hello world" functionality in both projects—the API starts a Fastify server with no routes, and the TUI prints a greeting—establishing a working foundation for subsequent feature development.

## Definition of Done

**API Scaffold (`api/`):**
1. pnpm workspace root at `api/` with single package `@unquote/api` at `api/packages/api/`
2. pnpm catalogs in `pnpm-workspace.yaml` organized by purpose (build, lint, testing, production)
3. TypeScript configured with strict settings (extends `@tsconfig/strictest` + `@tsconfig/node24`), ESM target
4. Fastify with `@eropple/fastify-openapi3`, `@fastify/type-provider-typebox` installed
5. Core production plugins installed: `@fastify/helmet`, `@fastify/cors`, `@fastify/under-pressure`, `@fastify/sensible`, `@fastify/rate-limit`
6. Vitest configured for testing
7. Oxlint with strict configuration (all categories enabled)
8. Oxfmt configured for formatting
9. A minimal entry point that starts Fastify (no routes) and a working `build` script
10. `task build:api` works successfully

**TUI Scaffold (`tui/`):**
1. Go module `github.com/bojanrajkovic/unquote/tui`
2. Simple `main.go` that prints "Hello, world!"
3. Binary output named `unquote` (not `tui`)
4. `task build:tui` works successfully

**Taskfile updates:**
- Change TUI binary output from `bin/tui` to `bin/unquote`

## Glossary

- **Fastify**: High-performance Node.js web framework focused on low overhead and developer experience
- **TypeBox**: TypeScript-first schema declaration library for compile-time type safety and runtime validation
- **OpenAPI 3**: Industry-standard specification for describing REST APIs, auto-generated from TypeBox schemas
- **pnpm**: Fast, disk-space-efficient package manager with content-addressable storage and monorepo workspaces
- **pnpm catalogs**: Centralized dependency version management organized by purpose (build, lint, testing, prod)
- **Oxlint**: JavaScript/TypeScript linter built in Rust, configured with restriction categories for strict enforcement
- **Oxfmt**: Code formatter companion to Oxlint, also built in Rust
- **Vitest**: Fast unit test framework compatible with Jest APIs but optimized for ESM
- **mise**: Polyglot version manager (successor to asdf) for Node.js, Go, and other tools
- **Task/Taskfile**: YAML-based task runner similar to Make, used to orchestrate builds
- **@tsconfig/strictest**: Shared TypeScript config preset enabling maximum type-safety options
- **@tsconfig/node24**: Shared TypeScript config preset optimized for Node.js 24

## Architecture

Two independent project scaffolds sharing a root Taskfile for orchestration:

**API (`api/`):** pnpm monorepo workspace with a single package `@unquote/api`. Uses pnpm catalogs to centralize dependency versions by purpose (build, lint, testing, prod). TypeScript configured for maximum strictness via `@tsconfig/strictest` and `@tsconfig/node24`. Fastify serves as the HTTP framework with TypeBox for schema validation and OpenAPI generation.

**TUI (`tui/`):** Standalone Go module producing a single binary. Minimal scaffold with room to grow into a full terminal UI application.

**Orchestration:** Root `Taskfile.yml` coordinates builds across both projects via `task build` (parallel) or individual `task build:api` / `task build:tui` commands.

## Existing Patterns

Investigation found established patterns in the root project:

- **mise.toml:** Version management for Node (LTS), Go (1.25.6), and Task runner
- **Taskfile.yml:** Task v3 format with namespace-style naming (`build:api`, `build:tui`)
- **Conventional Commits:** Scopes include `api` and `tui`
- **.gitignore:** Already excludes `node_modules/` and `bin/`

This design follows all existing patterns. No divergence.

## Implementation Phases

<!-- START_PHASE_1 -->
### Phase 1: API Workspace Setup
**Goal:** Initialize pnpm workspace with catalogs and base configuration

**Components:**
- `api/pnpm-workspace.yaml` — workspace definition with catalogs (build, lint, testing, prod)
- `api/package.json` — workspace-level scripts and shared devDependencies
- `api/tsconfig.json` — base TypeScript config extending strictest + node24
- `api/.oxlintrc.json` — strict linting configuration
- `api/.oxfmtrc.json` — formatter configuration

**Dependencies:** None (first phase)

**Done when:** `cd api && pnpm install` succeeds
<!-- END_PHASE_1 -->

<!-- START_PHASE_2 -->
### Phase 2: API Package Scaffold
**Goal:** Create the @unquote/api package with minimal Fastify server

**Components:**
- `api/packages/api/package.json` — package definition with catalog references
- `api/packages/api/tsconfig.json` — extends base config
- `api/packages/api/vitest.config.ts` — test configuration
- `api/packages/api/src/index.ts` — minimal Fastify entry point (no routes)

**Dependencies:** Phase 1 (workspace setup)

**Done when:** `cd api && pnpm build` succeeds, `pnpm --filter @unquote/api dev` starts server on port 3000
<!-- END_PHASE_2 -->

<!-- START_PHASE_3 -->
### Phase 3: TUI Scaffold
**Goal:** Initialize Go module with hello world

**Components:**
- `tui/go.mod` — module declaration for `github.com/bojanrajkovic/unquote/tui`
- `tui/main.go` — hello world entry point

**Dependencies:** None (independent of API phases)

**Done when:** `cd tui && go build -o bin/unquote .` succeeds, `./bin/unquote` prints "Hello, world!"
<!-- END_PHASE_3 -->

<!-- START_PHASE_4 -->
### Phase 4: Taskfile Integration
**Goal:** Update Taskfile and verify end-to-end builds

**Components:**
- `Taskfile.yml` — update `build:tui` to output `bin/unquote` instead of `bin/tui`

**Dependencies:** Phases 2 and 3 (both projects buildable)

**Done when:** `task build` succeeds (builds both projects), `task build:api` and `task build:tui` succeed individually
<!-- END_PHASE_4 -->

## Additional Considerations

**Oxlint restriction category:** Enabled to enforce strict coding standards (no eval, no var, explicit types). May require adjusting specific rules if legitimate use cases emerge.

**pnpm catalogs:** Using semver ranges (e.g., `^5.9.3`) for flexibility while maintaining consistency across packages.
