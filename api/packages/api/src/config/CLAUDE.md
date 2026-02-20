# Configuration

Last verified: 2026-02-16

## Purpose

Validates environment variables at startup using TypeBox schemas. Provides type-safe access to configuration throughout the application via `fastify.config`.

## Contracts

- **Exposes**: `EnvSchema` (TypeBox schema), `AppConfig` type
- **Guarantees**: Server fails fast if required env vars missing. `fastify.config` is fully typed after plugin registration. Dotenv loaded in non-production environments.
- **Expects**: `@fastify/env` plugin registered before DI container.

## Dependencies

- **Uses**: TypeBox, `@fastify/env`
- **Used by**: DI container (receives config), server startup
- **Boundary**: Pure configuration schema; no business logic

## Key Decisions

- TypeBox over Zod/Joi: Consistent with Fastify type provider, smaller bundle
- Fail-fast validation: Missing required vars cause immediate startup failure (no partial config)
- Type extensions in separate file: Keeps FastifyInstance augmentation isolated

## Invariants

- Required variables have no default (forces explicit configuration)
- Optional variables have sensible defaults
- All numeric config includes min/max bounds

## Key Files

- `schema.ts` - TypeBox schema defining all environment variables
- `type-extensions.ts` - TypeScript module augmentation for Fastify
- `index.ts` - Re-exports schema and type
