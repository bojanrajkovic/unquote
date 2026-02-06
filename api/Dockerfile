# syntax=docker/dockerfile:1

# ──────────────────────────────────────────────
# Stage 1: Base — shared Node.js + pnpm setup
# ──────────────────────────────────────────────
FROM node:24-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ──────────────────────────────────────────────
# Stage 2: Build — install, compile, deploy
# ──────────────────────────────────────────────
FROM base AS build

WORKDIR /workspace

# Copy workspace config files first (for layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/api/package.json packages/api/
COPY packages/game-generator/package.json packages/game-generator/

# Install all dependencies (including devDependencies for building)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build all packages
RUN pnpm run build

# Deploy @unquote/api with production dependencies only
RUN pnpm deploy --filter=@unquote/api --prod /deployed

# ──────────────────────────────────────────────
# Stage 3: Production — minimal runtime image
# ──────────────────────────────────────────────
FROM base AS production

# Create non-root user
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --shell /bin/sh --create-home appuser

WORKDIR /app

# Copy deployed application (dist + production node_modules)
COPY --from=build --chown=appuser:appgroup /deployed /app

# Copy quotes data file
COPY --from=build --chown=appuser:appgroup /workspace/resources/quotes.json /app/data/quotes.json

# Environment variable stubs for discoverability
ENV PORT=3000
ENV HOST=0.0.0.0
ENV LOG_LEVEL=info
ENV QUOTES_FILE_PATH=/app/data/quotes.json
ENV OTEL_EXPORTER_OTLP_ENDPOINT=""

EXPOSE 3000

# Switch to non-root user
USER appuser

# Health check using Node.js (node:24-slim does not include curl/wget)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => { if (!r.ok) throw new Error(); process.exit(0); }).catch(() => process.exit(1))"

CMD ["node", "--import", "./dist/instrumentation.js", "dist/index.js"]
