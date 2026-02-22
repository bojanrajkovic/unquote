# @unquote/web

Last verified: 2026-02-22

SvelteKit 5 static SPA for the Unquote cryptoquip game. Builds to a fully static site (no SSR) deployed to S3/CloudFront.

## Tech Stack

- **Framework**: SvelteKit 5 with `adapter-static` (fully prerendered, client-side routing)
- **UI**: Svelte 5 (runes mode: `$state`, `$derived`, `$effect`) + Tailwind CSS v4
- **Testing**: Vitest with jsdom environment
- **Build**: Vite 7, TypeScript 5.9

## Commands

- `pnpm run dev` - Start dev server
- `pnpm run build` - Build static site to `build/`
- `pnpm run test` - Run tests (vitest)
- `pnpm run check` - Type checking (svelte-check)
- `pnpm run format` - Format with Prettier + prettier-plugin-svelte

## Configuration

| Variable       | Build-time | Default                 | Description                       |
| -------------- | ---------- | ----------------------- | --------------------------------- |
| `VITE_API_URL` | Yes        | `http://localhost:3000` | Base URL for the Unquote REST API |

Set via `VITE_API_URL` environment variable at build time. In CI, injected from GitHub Actions variables.

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
- **`lib/api.ts`** - Typed HTTP client wrapping the REST API. Base URL from `VITE_API_URL`. Errors throw `Error` with user-readable messages.
- **`lib/claim-code.ts`** - Validates claim code format: `WORD-WORD-NNNN`.

### Routes

| Route    | Purpose                                                    |
| -------- | ---------------------------------------------------------- |
| `/`      | Landing page + onboarding (register, enter code, or skip)  |
| `/game`  | Game screen (puzzle grid, keyboard, timer, solution check) |
| `/stats` | Player statistics (requires claim code)                    |

### Key Contracts

- **Puzzle cells**: `buildCells()` returns `Cell[]` (LetterCell, HintCell, PunctCell, SpaceCell). LetterCells have `editIndex` for cursor navigation.
- **Conflict detection**: `detectConflicts()` flags cipher letters where two different ciphers map to the same plain letter (one-to-one cipher invariant). Includes hint cells in conflict map.
- **Solution assembly**: `assembleSolution()` builds the full plaintext from cells for submission to `POST /game/:id/check`.
- **Game persistence**: `StoredPuzzleState` is keyed by `date` + `puzzleId`. Stores full puzzle data alongside guesses so same-day reloads skip the API call. Stale state (different day) is discarded on load.
- **Puzzle loading**: The `/game` loader checks localStorage first; if the stored date matches today and puzzle data is present, it uses the cached puzzle. Only fetches from the API on cache miss or new day.
- **Session recording**: `recordSession()` is fire-and-forget. Failures never block the solved card.

### Invariants

- All localStorage access goes through `lib/storage.ts` typed functions
- Puzzle domain logic in `lib/puzzle.ts` has zero side effects (no Svelte, no IO)
- State singletons (`identity`, `game`) are the only writers to localStorage
- The `/game` route redirects to `/` if onboarding has not completed
- The `/stats` route redirects to `/` if no claim code is set

## Dependencies

- **Uses**: Unquote REST API (`/game/*`, `/player/*` endpoints)
- **Used by**: End users via browser; deployed to S3/CloudFront by `web-deploy.yml`
