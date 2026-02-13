# syntax=docker/dockerfile:1@sha256:b6afd42430b15f2d2a4c5a02b919e98a525b785b1aaff16747d2f623364e39b6

# ──────────────────────────────────────────────
# Stage 1: Base — shared Node.js + pnpm setup
# ──────────────────────────────────────────────
# Pin to digest for reproducible builds. Update periodically.
FROM node:24-slim@sha256:a81a03dd965b4052269a57fac857004022b522a4bf06e7a739e25e18bce45af2 AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ──────────────────────────────────────────────
# Stage 2: Build — install, compile, deploy
# ──────────────────────────────────────────────
FROM base AS build

WORKDIR /workspace

# Copy workspace config files first (for layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/api/package.json packages/api/
COPY packages/game-generator/package.json packages/game-generator/
COPY patches/ patches/

# Install all dependencies (including devDependencies for building)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build all packages
RUN pnpm run build

# Deploy @unquote/api with production dependencies only
RUN pnpm deploy --filter=@unquote/api --prod /deployed

# Strip unnecessary files from node_modules to reduce image size:
# - TypeScript source files (keep .js and .map for our own stack traces)
# - Documentation files (README, CHANGELOG, LICENSE, etc.)
RUN find /deployed/node_modules -type f \( \
      -name '*.ts' ! -name '*.d.ts' \
      -o -name 'README*' \
      -o -name 'CHANGELOG*' \
      -o -name 'LICENSE*' \
      -o -name 'LICENCE*' \
      -o -name '.npmignore' \
      -o -name '.eslintrc*' \
      -o -name '.prettierrc*' \
      -o -name 'tsconfig*.json' \
    \) -delete

# ──────────────────────────────────────────────
# Stage 3: Production — minimal runtime image
# ──────────────────────────────────────────────
FROM base AS production

# Remove global node_modules (npm, corepack) — not needed at runtime and may
# contain modules with known vulnerabilities.
RUN rm -rf /usr/local/lib/node_modules

# Create non-root user
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --shell /bin/sh --create-home appuser

WORKDIR /app

# Copy deployed application (dist + production node_modules)
COPY --from=build --chown=appuser:appgroup /deployed /app

# Copy quotes data file
COPY --from=build --chown=appuser:appgroup /workspace/resources/quotes.json /app/data/quotes.json

# Runtime configuration
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV LOG_LEVEL=info
ENV QUOTES_FILE_PATH=/app/data/quotes.json

EXPOSE 3000

# Switch to non-root user
USER appuser

# Health check using Node.js (node:24-slim does not include curl/wget)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => { if (!r.ok) throw new Error(); process.exit(0); }).catch(() => process.exit(1))"

CMD ["node", "--import", "./dist/instrumentation.js", "dist/index.js"]
