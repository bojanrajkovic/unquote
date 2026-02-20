# Integration Test Principles

## What This Refactor Fixed

The integration test suite had accumulated several structural anti-patterns that made tests harder to read, maintain, and debug:

- **One-describe-per-test nesting**: Many files wrapped each test in its own `describe` block, adding indentation without meaningful grouping.
- **Missing arrange/act/assert boundaries**: It was unclear where setup ended and verification began.
- **Per-test setup duplicated in beforeAll**: Setup that only applied to one test was hoisted into shared hooks, making it harder to understand individual test preconditions.
- **Inconsistent AC references**: Acceptance criteria IDs were sometimes in describe names, sometimes absent entirely.

## Core Principles

### 1. Arrange / Act / Assert

Every test should have explicit `// arrange`, `// act`, and `// assert` comments marking the three phases. When a test has no per-test setup (e.g. it relies entirely on shared `beforeAll` state), start with `// act` or `// assert` as appropriate.

For shared setup in `beforeAll`/`beforeEach`, use `// arrange (shared)` to distinguish it from per-test arrangement.

### 2. Flat Describe Structure

Use a single top-level `describe` per module or feature area. Avoid wrapping individual tests in their own `describe` blocks unless there is a genuine grouping reason (e.g. `store.test.integration.ts` groups by method: `createPlayer`, `recordSession`, `getStats`).

The goal is to minimize nesting depth while preserving meaningful organization.

### 3. Shared Setup Only When Truly Shared

`beforeAll` and `beforeEach` should only contain setup that every test in the block actually uses. If only one or two tests need a particular mock or fixture, move that setup inline into the test's `// arrange` section.

This makes each test self-contained and easier to understand in isolation.

### 4. AC References in Test Names

Embed acceptance criteria IDs directly in `it()` descriptions when the project tracks them:

```typescript
it("AC1.1: returns 201 with claimCode from mock store", ...)
it("AC2.3: returns 404 when claim code is unknown", ...)
```

This creates a direct link between test output and requirements, making it easy to verify coverage.

### 5. Correct Testing Layer

Integration tests should exercise the real integration points (HTTP layer, database, external services) rather than reimplementing unit-level checks. If a test only validates pure logic with mocked dependencies, it belongs in a unit test file instead.

### 6. Shared Test Helpers (Chekhov's Gun)

Extract repeated test infrastructure into shared helpers (e.g. `createTestFastify()` for wiring up Fastify with DI). Introduce the helper in a dedicated commit before the tests that use it, so reviewers see the definition before the usage.

Helpers live in `tests/helpers/` and are imported by test files. They should be focused on infrastructure wiring, not test-specific logic.

## What We Left Alone

- **Unit test files** (`*.test.ts` without `.integration`): These were out of scope. Only integration test files were refactored.
- **Test logic and assertions**: The actual behavior being tested was not changed. Only structure, comments, and organization were modified.
- **PGlite snapshot pattern**: The `store.test.integration.ts` file's `createMigratedSnapshot`/`restoreSnapshot` pattern was already well-structured and was kept as-is.

## Files Changed

### New files
- `api/packages/api/tests/helpers/fastify.ts` -- shared `createTestFastify()` helper

### Modified files
- `api/packages/api/src/domain/game/routes/puzzle.test.integration.ts`
- `api/packages/api/src/domain/game/routes/solution.test.integration.ts`
- `api/packages/api/src/domain/game/routes/openapi.test.integration.ts`
- `api/packages/api/src/domain/player/routes/register.test.integration.ts`
- `api/packages/api/src/domain/player/routes/session.test.integration.ts`
- `api/packages/api/src/domain/player/routes/stats.test.integration.ts`
- `api/packages/api/src/domain/player/store.test.integration.ts`
- `api/packages/game-generator/src/integration.test.ts`
- `api/packages/game-generator/src/tracing.integration.test.ts`
