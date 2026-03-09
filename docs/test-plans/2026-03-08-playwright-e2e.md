# Human Test Plan: Playwright E2E Tests with Coverage

Generated from implementation plan: `docs/implementation-plans/2026-03-08-playwright-e2e/`

## Prerequisites

- Node.js 24+, pnpm 10, and mise installed
- Run `pnpm install --frozen-lockfile` in `web/`
- Run `pnpm exec svelte-kit sync` in `web/`
- Run `pnpm exec playwright install chromium --with-deps` in `web/`

## Phase 1: Source Map and Coverage Report Verification

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `cd web && pnpm run coverage:full` | Command completes successfully; terminal shows merged coverage text summary |
| 2 | Open `web/coverage/merged/index.html` in a browser | File list shows paths like `src/lib/puzzle.ts`, `src/lib/api.ts`, `src/lib/state/game.svelte.ts`, `src/routes/game/+page.svelte` -- not hashed chunk filenames |
| 3 | Click into `src/lib/puzzle.ts` in the coverage report | Line-level coverage highlighting is visible; green/red bars align with actual TypeScript source lines |
| 4 | Click into a `.svelte` file (e.g., `src/routes/+page.svelte`) | Coverage shows original Svelte template markup and script sections, not compiled output |
| 5 | Check the text summary printed to terminal | Non-zero percentages shown for Statements, Branches, Functions, and Lines |

## Phase 2: Screenshot Visual Review

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `cd web && pnpm run build && pnpm run test:e2e` | All Playwright tests pass |
| 2 | Open `web/test-results/onboarding-landing.png` | Shows the Unquote landing page with title, tagline, and CTA button; text is fully rendered (no FOIT) |
| 3 | Open `web/test-results/onboarding-choose.png` | Shows three choice cards: register, skip, enter code; layout is not broken |
| 4 | Open `web/test-results/onboarding-claim-code.png` | Shows claim code "AMBER-HAWK-7842" in ticket-style display |
| 5 | Open `web/test-results/onboarding-enter-code.png` | Shows code input field filled with "AMBER-HAWK-7842" and "Link Account" button |
| 6 | Open `web/test-results/onboarding-invalid-code.png` | Shows error message below the input |
| 7 | Open `web/test-results/onboarding-register-error.png` | Shows error message and choose-step choices still visible |
| 8 | Open `web/test-results/game-loaded.png` | Shows puzzle grid with cells, clue chip "X = H", timer; all cells empty |
| 9 | Open `web/test-results/game-conflict.png` | Shows at least one cell highlighted as a conflict |
| 10 | Open `web/test-results/game-solved.png` | Shows solved card with "HELLO WORLD", "Test Author", and completion time |
| 11 | Open `web/test-results/game-error.png` | Shows error message with back button |
| 12 | Open `web/test-results/game-solved-elsewhere.png` | Shows solved-elsewhere card with "Already Solved" text |
| 13 | Open `web/test-results/stats-primary-tiles.png` | Shows 4 stat tiles with values 42, 38, 90%, 12 |
| 14 | Open `web/test-results/stats-chart.png` | Shows chart with "Solve Times" title and visible data points |
| 15 | Open `web/test-results/stats-empty-state.png` | Shows empty state with "create account" CTA link |
| 16 | Open `web/test-results/stats-error.png` | Shows error message in stats layout |
| 17 | Open `web/test-results/faq-page.png` | Shows FAQ page with heading and "How to Play" section |

## Phase 3: CI Pipeline Verification

| Step | Action | Expected |
|------|--------|----------|
| 1 | Push the branch and open a PR against `main` | The `web-pr.yml` workflow triggers |
| 2 | Check "Unit tests (with coverage)" step logs | Vitest runs with Istanbul coverage; coverage summary printed |
| 3 | Check "Build (with coverage instrumentation)" step logs | Build completes with Istanbul plugin activity visible |
| 4 | Check "Run E2E tests" step logs | All spec files run; all tests pass; test count matches expected |
| 5 | Check "Merge coverage reports" step logs | `nyc merge` succeeds; text summary shows non-zero coverage |
| 6 | Check "Upload E2E screenshots" step | Artifact named `e2e-screenshots` uploaded with all expected PNGs |
| 7 | Check the PR comment | Comment titled "E2E Screenshots" with link to Actions artifacts |

## End-to-End: Normal Build Has No Instrumentation

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `cd web && pnpm run build` (without VITE_COVERAGE) | Build succeeds |
| 2 | Search for `__coverage__` in `build/` output | No matches; production bundle is not instrumented |
| 3 | Run `pnpm run preview` and check browser console | `window.__coverage__` is `undefined` |

## Human Verification Required

| Criterion | Why Manual | Steps |
|-----------|-----------|-------|
| playwright-e2e.AC1.8 | Source map mapping requires visual inspection | Run `coverage:full`, open merged HTML report, verify source paths are original `.ts`/`.svelte` files |
| playwright-e2e.AC6.4 | Screenshot quality requires human review | Run `test:e2e`, open each PNG, verify correct page state, text rendered, layout intact |
| playwright-e2e.AC7.1-AC7.3 | CI execution requires real PR run | Push branch, open PR, verify workflow steps pass |
