# @unquote/web

Last verified: 2026-03-09

SvelteKit 5 static SPA for the Unquote cryptoquip game. Builds to a fully static site (no SSR) deployed to S3/CloudFront.

## Tech Stack

- **Framework**: SvelteKit 5 with `adapter-static` (fully prerendered, client-side routing)
- **UI**: Svelte 5 (runes mode: `$state`, `$derived`, `$effect`) + Tailwind CSS v4
- **Testing**: Vitest (unit, V8 coverage) + Playwright (E2E)
- **Build**: Vite 7, TypeScript 5.9

## Commands

- `pnpm run dev` - Start dev server
- `pnpm run build` - Build static site to `build/`
- `pnpm run preview` - Preview production build locally
- `pnpm run test` - Run unit tests (vitest) — use `mise run test` to ensure Node v24
- `pnpm run test:e2e` - Run E2E tests (Playwright, requires build and preview server)
- `pnpm run coverage` - Run unit tests with V8 coverage report
- `pnpm run check` - Type checking (svelte-check)
- `pnpm run format` - Format with Prettier + prettier-plugin-svelte

## Configuration

| Variable       | Build-time | Default                 | Description                       |
| -------------- | ---------- | ----------------------- | --------------------------------- |
| `VITE_API_URL` | Yes        | `http://localhost:3000` | Base URL for the Unquote REST API |

Set via environment variables at build time. In CI, injected from GitHub Actions variables.

## Architecture

### State Management

Svelte 5 runes with singleton class instances (not stores). Two global state objects:

- **`identity`** (`lib/state/identity.svelte.ts`) - Player claim code and onboarding status. Hydrated from localStorage on load, all writes immediately persisted.
- **`game`** (`lib/state/game.svelte.ts`) - Puzzle data, guesses, timer, cursor, solve status. Persisted to localStorage on every mutation. Keyed by date so a new day automatically starts fresh.

### Storage Layer

- **`lib/storage.ts`** - Typed localStorage abstraction. All keys declared in `STORAGE_KEYS`. Never call `localStorage` directly.
- Keys: `unquote_claim_code`, `unquote_puzzle`, `unquote_has_onboarded`

### Domain Logic

- **`lib/puzzle.ts`** - Pure, stateless functions: `buildCells`, `detectConflicts`, `formatTimer`, `assembleSolution`. No Svelte, no IO. Fully unit-testable.
- **`lib/api.ts`** - Typed HTTP client wrapping the REST API. Base URL from `VITE_API_URL`. Errors throw `Error` with user-readable messages. `getSession()` returns null on any failure (404, network, server error) to avoid blocking gameplay.
- **`lib/claim-code.ts`** - Validates claim code format: `WORD-WORD-NNNN`.

### Routes

| Route    | Purpose                                                    |
| -------- | ---------------------------------------------------------- |
| `/`      | Landing page + onboarding (register, enter code, or skip)  |
| `/game`  | Game screen (puzzle grid, keyboard, timer, solution check) |
| `/stats` | Player statistics (requires claim code)                    |
| `/faq`   | Static FAQ page (how to play, game rules)                  |

### Share Module (`lib/share/`)

Wordle-style sharing for session results and player stats. Follows Functional Core / Imperative Shell split.

- **Functional Core** (`format.ts`): Pure formatters. `formatSessionText(data)` and `formatStatsText(stats)` produce emoji-grid text. `buildLetterGrid(cells)` renders decode progress as gold/white squares.
- **Imperative Shell** (`actions.ts`): Side-effectful clipboard, download, and Web Share API operations. All return `boolean` for success/failure.
- **Image capture** (`capture.ts`): `captureElementAsBlob(element)` renders Svelte card components to PNG via `modern-screenshot`. Returns `null` on failure.
- **Capability detection** (`detect.ts`): `canCopyImage()` and `canNativeShare()` check browser API availability at runtime.
- **Components**: `SessionShareCard.svelte`, `StatsShareCard.svelte` (1200x628 branded cards for image capture), `ShareMenu.svelte` (dropdown with progressive enhancement: text copy, image copy, native share, download).

### Key Contracts

- **Puzzle cells**: `buildCells()` returns `Cell[]` (LetterCell, HintCell, PunctCell, SpaceCell). LetterCells have `editIndex` for cursor navigation.
- **Conflict detection**: `detectConflicts()` flags cipher letters where two different ciphers map to the same plain letter (one-to-one cipher invariant). Includes hint cells in conflict map.
- **Solution assembly**: `assembleSolution()` builds the full plaintext from cells for submission to `POST /game/:id/check`.
- **Game persistence**: `StoredPuzzleState` is keyed by `date` + `puzzleId`. Stores full puzzle data alongside guesses so same-day reloads skip the API call. Stale state (different day) is discarded on load. `solvedElsewhere` flag persisted for remote completions.
- **Puzzle loading**: The `/game` loader runs three stages: (1) check localStorage for same-day cache, (2) fetch from API on cache miss, (3) for registered players not locally solved, check for remote completion via `getSession()`. Remote completion triggers `markSolvedElsewhere()`.
- **Remote completion**: When a puzzle was solved on another device, the game transitions to solved state with `solvedElsewhere=true`. Shows a solved-elsewhere card without decoded quote (no guess data available).
- **Session recording**: `recordSession()` is fire-and-forget. Failures never block the solved card.

### Invariants

- All localStorage access goes through `lib/storage.ts` typed functions
- Puzzle domain logic in `lib/puzzle.ts` has zero side effects (no Svelte, no IO)
- State singletons (`identity`, `game`) are the only writers to localStorage
- The `/game` route redirects to `/` if onboarding has not completed
- The `/stats` route redirects to `/` if no claim code is set

## Dependencies

- **Uses**: Unquote REST API (`/game/*`, `/player/*` endpoints), `modern-screenshot` (DOM-to-PNG capture for share cards)
- **Used by**: End users via browser; deployed to S3/CloudFront by `web-deploy.yml`
- **Dev**: `@playwright/test` for E2E tests (`web/tests/`), `@vitest/coverage-v8` for unit test coverage
