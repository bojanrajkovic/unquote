# API Containerization Design

## Summary

This design introduces Docker containerization for the Unquote API server, enabling consistent deployment across any container runtime. The approach uses a three-stage Dockerfile that builds the pnpm monorepo, isolates production dependencies using `pnpm deploy` to create a workspace-aware standalone bundle, and packages everything into a minimal `node:24-slim` image running as a non-root user. The container bakes in the quotes data file and preserves the existing OpenTelemetry instrumentation loader pattern required for distributed tracing.

The CI/CD pipeline leverages GitHub Actions with native ARM64 runners to build multi-platform images (amd64/arm64) in parallel without QEMU emulation overhead, then merges the per-platform digests into a single manifest tagged with semantic versions and commit SHAs. Images are published to GitHub Container Registry on pushes to `main` and version tags, while pull requests trigger validation-only builds. A new `/health` endpoint supports container health checks without requiring additional dependencies or configuration.

## Definition of Done

- A multi-stage Dockerfile in the `api/` directory that builds a minimal, production-ready container image for the Unquote API using `node:24-slim` as the base, with `pnpm deploy` for dependency isolation
- A `.dockerignore` file to exclude unnecessary files from the build context
- A GitHub Actions workflow that builds multi-platform (amd64/arm64) images and pushes to GHCR on pushes to `main` (tagged `latest` + sha) and version tags (semver tags), with validation-only builds on PRs
- The container runs as a non-root user, bakes in the quotes data file, and starts with the correct OpenTelemetry instrumentation loader (`--import`)
- The Dockerfile declares `ENV` stubs for all supported environment variables (`PORT`, `HOST`, `LOG_LEVEL`, `QUOTES_FILE_PATH`, `OTEL_EXPORTER_OTLP_ENDPOINT`) with sensible defaults where applicable, for discoverability
- No deployment-target-specific configs (no K8s manifests, Helm charts, etc.)

## Glossary

- **Multi-stage Dockerfile**: A Dockerfile with multiple `FROM` statements that allows separating build-time dependencies from the final runtime image, reducing image size and attack surface.
- **pnpm deploy**: A pnpm command that creates a standalone copy of a workspace package with only its production dependencies, resolving `workspace:*` protocol dependencies by copying published files from sibling packages.
- **`workspace:*` protocol**: A pnpm-specific dependency version specifier indicating that a package depends on another package within the same pnpm workspace, resolved at build time from the monorepo.
- **BuildKit cache mount**: A Docker BuildKit feature (`RUN --mount=type=cache`) that persists a directory (like the pnpm store) across builds, avoiding redundant package downloads.
- **GHCR (GitHub Container Registry)**: GitHub's Docker registry service for hosting container images, integrated with GitHub Actions for authentication and access control.
- **Multi-platform manifest**: A container image manifest that references multiple platform-specific images (e.g., amd64, arm64) under a single tag, allowing clients to automatically pull the correct architecture.
- **Build by digest**: A Docker build strategy where each platform-specific image is pushed individually with a unique SHA-256 digest, then combined into a multi-arch manifest without re-pushing layer data.
- **OpenTelemetry ESM loader**: A Node.js module loader hook (registered via `--import`) that automatically instruments application code for distributed tracing before modules are evaluated.
- **Fastify plugin**: Fastify's modular architecture pattern where routes, middleware, and configuration are encapsulated as reusable plugins registered via `fastify.register()`.
- **Awilix**: A dependency injection container for Node.js that manages service lifecycles (singleton, scoped, transient) and resolves constructor dependencies automatically.
- **TypeBox**: A JSON Schema Type Builder that provides compile-time TypeScript types and runtime validation schemas from a single definition, used with Fastify for request/response validation.
- **`@fastify/env`**: A Fastify plugin that loads environment variables and validates them against a schema, failing fast on missing required configuration.
- **Semver tags**: Semantic versioning tags (e.g., `v1.2.3`) that map to container image tags following major.minor.patch conventions, with implied `1.2` and `1` shortcuts pointing to the latest compatible versions.
- **`docker/metadata-action`**: A GitHub Action that generates Docker tags and labels based on Git metadata (branch names, tags, commit SHAs, PR numbers).
- **Path filter**: A GitHub Actions workflow filter that triggers jobs only when specific files or directories change, reducing unnecessary builds.

## Architecture

Three-stage Dockerfile in `api/Dockerfile` with build context scoped to `api/`. CI/CD via GitHub Actions pushes multi-platform images to GHCR.

### Container Image (api/Dockerfile)

**Stage 1 — `base`:** `node:24-slim` (Debian Bookworm) with pnpm enabled via corepack. Shared by build and production stages to guarantee identical Node versions.

**Stage 2 — `build`:** Copies the full pnpm workspace, installs dependencies with `--frozen-lockfile` using a BuildKit cache mount for the pnpm store, compiles both packages via `pnpm run build`, then runs `pnpm deploy --filter=@unquote/api --prod /deployed` to create a standalone directory containing only `@unquote/api`'s production dependencies (including `@unquote/game-generator`'s `dist/` output resolved from the workspace).

**Stage 3 — `production`:** Fresh `node:24-slim` (no pnpm at runtime). Creates non-root user `appuser` (UID 1001). Copies `/deployed` from the build stage. Copies `resources/quotes.json` to `/app/data/quotes.json`. Declares ENV stubs for discoverability:

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | Server listen port |
| `HOST` | `0.0.0.0` | Server bind address |
| `LOG_LEVEL` | `info` | Pino log level |
| `QUOTES_FILE_PATH` | `/app/data/quotes.json` | Path to quotes data |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | *(empty)* | OpenTelemetry collector URL |

Start command: `node --import ./dist/instrumentation.js dist/index.js`

Includes `HEALTHCHECK` hitting `GET /health` and `EXPOSE 3000`.

### CI/CD Pipeline (.github/workflows/api-docker.yml)

**Triggers:**
- Push to `main` — path-filtered to `api/**`
- Version tags (`v*`) — no path filter
- Pull requests targeting `main` — path-filtered to `api/**`, build-only (no push)

**Job 1 — `build`** (matrix, runs in parallel):

| Platform | Runner |
|----------|--------|
| `linux/amd64` | `ubuntu-latest` |
| `linux/arm64` | `ubuntu-24.04-arm` |

Each runner builds its native platform using `docker/build-push-action@v6` and pushes **by digest** to GHCR. No QEMU emulation — native ARM hardware on GitHub's free ARM runners.

Uses `docker/metadata-action@v5` to generate tags:
- Main push: `latest`, `main-<sha>`
- Version tag: `<semver>`, `<major>.<minor>`
- PR: `pr-<number>` (build only)

Caching: `cache-from: type=gha` / `cache-to: type=gha,mode=max`

**Job 2 — `merge`** (depends on `build`):

Runs on `ubuntu-latest`. Uses `docker buildx imagetools create` to combine per-platform digests into a single multi-arch manifest, applying all tags from the metadata action.

**Permissions:** `contents: read`, `packages: write`

**Image name:** `ghcr.io/<owner>/unquote-api`

### Health Endpoint

Minimal `GET /health` route returning `200 { status: "ok" }`. Registered as a Fastify route following the existing plugin pattern. Used by the Dockerfile `HEALTHCHECK` and available for Kubernetes liveness/readiness probes.

### .dockerignore

Placed at `api/.dockerignore`. Excludes: `node_modules/`, `dist/`, `.git/`, `*.test.ts`, `*.test.integration.ts`, `*.spec.ts`, `coverage/`, `.env*`, `docs/`, `.serena/`, `.claude/`, `.worktrees/`, `*.md` (except package files).

## Existing Patterns

**pnpm workspace:** The monorepo uses `pnpm-workspace.yaml` with `packages/*` and version catalogs (`catalog:prod`, `catalog:build`, etc.). The Dockerfile respects this by running `pnpm install` at the workspace root and using `pnpm deploy` to extract the target package.

**Fastify route registration:** Routes are registered as Fastify plugins. The health endpoint follows this pattern — a new route module in the domain layer.

**@fastify/env config validation:** Environment variables are validated at startup via TypeBox schema in `src/config/schema.ts`. The health endpoint does not require config changes.

**Awilix DI container:** Singleton and request-scoped dependencies registered in `src/deps/`. The health endpoint is stateless and does not require DI registration.

**OpenTelemetry ESM loader:** The `--import ./dist/instrumentation.js` flag registers the OpenTelemetry ESM loader hook before the application starts. This must be preserved in the container's CMD.

**`workspace:*` protocol:** `@unquote/api` depends on `@unquote/game-generator` via `workspace:*`. When `pnpm deploy` runs, it resolves this by copying the dependency's published files (governed by `"files"` in package.json) into the deployed directory.

## Implementation Phases

<!-- START_PHASE_1 -->
### Phase 1: Package.json `files` Fields

**Goal:** Configure both workspace packages so `pnpm deploy` only includes compiled output.

**Components:**
- `api/packages/api/package.json` — add `"files": ["dist"]`
- `api/packages/game-generator/package.json` — add `"files": ["dist"]`

**Dependencies:** None

**Done when:** `pnpm deploy --filter=@unquote/api --prod /tmp/test-deploy` produces a directory containing only `dist/` output and `node_modules/` with production dependencies (no source files, no test files).
<!-- END_PHASE_1 -->

<!-- START_PHASE_2 -->
### Phase 2: Health Endpoint

**Goal:** Add a minimal liveness endpoint for container health checks.

**Components:**
- Health route module in `api/packages/api/src/domain/health/` — `GET /health` returning `{ status: "ok" }`
- Route registration in the Fastify application setup

**Dependencies:** None (can run in parallel with Phase 1)

**Done when:** `GET /health` returns `200 { status: "ok" }`, with passing unit tests.
<!-- END_PHASE_2 -->

<!-- START_PHASE_3 -->
### Phase 3: Dockerfile

**Goal:** Multi-stage Dockerfile that produces a minimal production image.

**Components:**
- `api/Dockerfile` — three stages: `base`, `build`, `production`
- `api/.dockerignore` — build context exclusions

**Dependencies:** Phase 1 (files fields required for `pnpm deploy` to work correctly)

**Done when:** `docker build -t unquote-api ./api` succeeds. Container starts, responds to `GET /health` with 200, and runs as non-root user (verified via `docker exec ... whoami`).
<!-- END_PHASE_3 -->

<!-- START_PHASE_4 -->
### Phase 4: GitHub Actions Workflow

**Goal:** CI/CD pipeline that builds multi-platform images and pushes to GHCR.

**Components:**
- `.github/workflows/api-docker.yml` — build job (matrix: amd64 + arm64), merge job (manifest creation)

**Dependencies:** Phase 3 (Dockerfile must exist)

**Done when:** Workflow file passes `actionlint` validation. Manual push to a feature branch triggers a validation build (no push). Merge to main triggers build + push to GHCR with correct tags.
<!-- END_PHASE_4 -->

## Additional Considerations

**Quotes data updates:** Since quotes are baked into the image, updating the quotes file requires rebuilding and redeploying the container. This is acceptable for the current use case (quotes change infrequently). If quotes need dynamic updates in the future, the `QUOTES_FILE_PATH` env var can be pointed at a mounted volume instead.

**GHCR package visibility:** New GHCR packages default to private. After the first push, the package visibility may need to be manually set to public (or configured via repository settings) if the image should be publicly pullable.

**Cache invalidation:** The BuildKit cache mount for the pnpm store persists across builds within the same GHA cache scope. If dependencies become corrupted, the cache can be cleared by incrementing a cache key suffix or manually purging via the GitHub Actions cache API.
