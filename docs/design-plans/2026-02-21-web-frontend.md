# Web Frontend Design

## Summary

This project adds a web frontend to the Unquote monorepo: a single-page application built with Svelte 5 and SvelteKit that lets players solve the daily cryptoquip puzzle in a browser. The app is compiled to static files by SvelteKit's adapter-static and deployed to AWS S3 with CloudFront as the CDN, keeping operational complexity low with no server to run. It joins the existing `api/` and `tui/` packages as `web/` in the pnpm workspace, following the same project conventions.

The implementation is organized as seven sequential phases: provisioning AWS infrastructure with Terraform, scaffolding the SvelteKit project with Tailwind v4 design tokens, building the shared state and API client layer, then implementing each screen in order (landing and onboarding, game, stats), and finally wiring up the CI/CD deployment workflow. All game state — guesses, timer, claim code identity — is persisted to localStorage so the puzzle resumes correctly across page reloads without touching the server. The app communicates with the existing REST API and is designed to degrade gracefully: players can skip registration entirely and play anonymously, and deployment uses short-lived OIDC credentials rather than stored AWS keys.

## Definition of Done

A Svelte 5 + SvelteKit SPA in `web/` that faithfully implements the 6-screen prototype (Landing → Onboarding → Registration/Claim Code → Game → Stats), styled with the existing design tokens from the prototype.

Game state persists to localStorage: letter guesses, timer start timestamp (resumed on reload, keyed per puzzle date), and claim code identity.

Communicates with the existing REST API (`/player`, `/game/today`, `/game/:id/check`, `/player/:code/stats`) with the API URL configurable via Vite env var (`VITE_API_URL`).

A CI workflow builds and deploys static files to S3/CloudFront on merge to main.

**Out of scope:** PWA, SSR, shadcn/ui, TanStack Pacer/Router/Hotkeys.

## Acceptance Criteria

### web-frontend.AC1: Six-screen prototype faithfully implemented

- **web-frontend.AC1.1 Success:** Landing screen displays animated demo cells, tagline, and "Play Today's Puzzle" button
- **web-frontend.AC1.2 Success:** Onboarding screen presents three choices: register, skip, enter existing code
- **web-frontend.AC1.3 Success:** Registration path calls POST /player, displays claim code ticket with copy button, then navigates to /game
- **web-frontend.AC1.4 Success:** "Enter claim code" path accepts WORD-WORD-0000 format and navigates to /game on valid input
- **web-frontend.AC1.5 Success:** "Skip" path marks onboarding complete and navigates to /game without a claim code
- **web-frontend.AC1.6 Success:** Game screen renders puzzle grid, timer, progress bar, clue chips, and difficulty badge
- **web-frontend.AC1.7 Success:** Stats screen renders 4 primary tiles, SVG line chart, and secondary stat rows for a player with a claim code
- **web-frontend.AC1.8 Failure:** Navigating directly to /game before onboarding completes redirects to /
- **web-frontend.AC1.9 Failure:** Invalid claim code format (not WORD-WORD-0000) shows inline validation error without navigating
- **web-frontend.AC1.10 Success:** Onboarding choice cards respond to both Enter and Space when keyboard-focused (WCAG 2.1 AA `role="button"` requirement)

### web-frontend.AC2: Game mechanics match prototype

- **web-frontend.AC2.1 Success:** Letter key fills the active cell and advances cursor to next editable cell
- **web-frontend.AC2.2 Success:** Backspace on a filled cell clears it; Backspace on an empty cell moves cursor back and clears that cell
- **web-frontend.AC2.3 Success:** ArrowLeft and ArrowRight navigate between editable cells; navigation stops at boundaries
- **web-frontend.AC2.4 Success:** Enter key submits the current solution
- **web-frontend.AC2.5 Success:** Ctrl+C clears all editable cells
- **web-frontend.AC2.6 Success:** Clicking a cell moves the cursor to that cell
- **web-frontend.AC2.7 Success:** All cells sharing the same cipher letter highlight as "related" when one is active
- **web-frontend.AC2.8 Success:** Two cipher letters mapped to the same plain letter both highlight as "conflict" (amber)
- **web-frontend.AC2.9 Success:** Hint cells are displayed in teal and are not editable
- **web-frontend.AC2.10 Success:** Progress bar updates on every keystroke reflecting filled/total editable cells
- **web-frontend.AC2.11 Success:** Correct submission triggers staggered green flip animation followed by solved card with decoded quote, attribution, and elapsed time
- **web-frontend.AC2.12 Failure:** Submitting with unfilled cells shows a warning message without checking
- **web-frontend.AC2.13 Failure:** Submitting with conflict cells shows a warning message without checking
- **web-frontend.AC2.14 Failure:** Incorrect submission shows an error message and allows continued play
- **web-frontend.AC2.15 Success:** Puzzle cells can be focused via Tab key; pressing Enter or Space on a focused cell activates it (moves cursor to that cell and captures keyboard input)
- **web-frontend.AC2.16 Success:** Tab moves cursor to the next editable cell (same as ArrowRight); Shift+Tab moves to the previous editable cell (same as ArrowLeft); both stop at boundaries
- **web-frontend.AC2.17 Success:** Any click within the game screen area re-focuses the hidden keyboard capture input

### web-frontend.AC3: Game state persists to localStorage

- **web-frontend.AC3.1 Success:** Letter guesses survive a page reload — the puzzle resumes with previously entered letters
- **web-frontend.AC3.2 Success:** Timer resumes from elapsed time on reload within the same puzzle day
- **web-frontend.AC3.3 Success:** Claim code persists across browser sessions (survives tab close and reopen)
- **web-frontend.AC3.4 Success:** A new day's puzzle starts fresh (no carry-over of previous day's guesses or timer)
- **web-frontend.AC3.5 Edge:** Only two localStorage keys are written (`unquote_claim_code`, `unquote_puzzle`) — no accumulation of per-date keys

### web-frontend.AC4: API communication works correctly

- **web-frontend.AC4.1 Success:** Today's puzzle loads from GET /game/today on first visit of the day
- **web-frontend.AC4.2 Success:** Same-day reload rehydrates puzzle from localStorage without an API call
- **web-frontend.AC4.3 Success:** Solution check calls POST /game/:id/check and handles correct response
- **web-frontend.AC4.4 Success:** Stats screen loads data from GET /player/:code/stats when claim code is present
- **web-frontend.AC4.5 Success:** API base URL is configurable via VITE_API_URL env var at build time
- **web-frontend.AC4.6 Failure:** Stats screen shows appropriate empty state when no claim code is present (no API call made)
- **web-frontend.AC4.7 Failure:** API fetch failure shows a user-visible error message (not a silent crash)

### web-frontend.AC5: CI deploys to S3/CloudFront

- **web-frontend.AC5.1 Success:** A merge to main touching web/** triggers web-deploy.yml and deploys successfully
- **web-frontend.AC5.2 Success:** CloudFront serves the updated build after deployment (invalidation completes)
- **web-frontend.AC5.3 Success:** Direct navigation to /game is served correctly by CloudFront (404→fallback→SvelteKit router)
- **web-frontend.AC5.4 Success:** No long-lived AWS credentials are stored as GitHub secrets — deployment uses OIDC role assumption

## Glossary

- **SPA (Single-Page Application)**: A web app that loads once and handles all navigation client-side without full page reloads. Here implemented with SvelteKit's adapter-static, which pre-builds the app to plain HTML/CSS/JS files.
- **SvelteKit**: A full-stack framework built on top of Svelte. This project uses only its static export mode (`adapter-static`), treating it as a client-side router and build tool.
- **Svelte 5**: A UI component framework. Version 5 introduces `$state` and `$derived` runes — a new reactivity model where state is declared with special syntax rather than reactive assignments.
- **adapter-static**: The SvelteKit adapter that outputs a directory of static files suitable for hosting on a CDN or object store, with no Node.js server required at runtime.
- **Tailwind v4**: A utility-first CSS framework. Version 4 changes configuration from a JavaScript config file to a CSS-native `@theme` block, generating both CSS custom properties and utility classes from a single source.
- **`@theme` block**: Tailwind v4 syntax for defining design tokens (colors, fonts, spacing) inside CSS. Tokens declared here become both CSS custom properties and Tailwind utility classes (e.g., `bg-gold`).
- **Design tokens**: Named, reusable values (colors, typography, spacing) that define the visual language of an application. Centralizing them means every component references the same gold, teal, amber, etc. rather than hardcoded hex values.
- **Runes (`$state`, `$derived`)**: Svelte 5's reactivity primitives. `$state` declares reactive fields; `$derived` computes values from other state automatically. Both are used in the class-based state modules.
- **Cryptoquip**: A variety of cryptogram puzzle where a quote is encrypted by substituting each letter with a different letter. The cipher is a simple one-to-one letter substitution; solving it means finding the substitution key.
- **Cipher letter / plain letter**: In the puzzle, each character is encoded. The *cipher letter* is the encrypted character shown in the puzzle; the *plain letter* is the decoded character the player guesses.
- **Claim code**: A `WORD-WORD-0000` format identifier returned by the API when a player registers. It serves as a portable, human-readable player identity — stored in localStorage and submitted when recording sessions or fetching stats.
- **localStorage**: A browser API for persisting key-value string data across page reloads and browser sessions. Unlike cookies, it is never sent to the server. Used here to store guesses, timer state, and claim code.
- **Onboarding state machine**: The `/` route manages a sequence of named steps (`landing → choose → registering → registered → enter-code`) before navigating to `/game`. "State machine" refers to the explicit enumeration of allowed states and transitions, not a library.
- **View Transitions API**: A browser API (currently Chromium-only) for animating between page navigations. SvelteKit's `onNavigate` hook integrates with it; the app falls back silently to instant transitions on unsupported browsers.
- **CloudFront**: AWS's content delivery network (CDN). Serves the static files from S3 globally and handles the 404-to-SPA fallback required for client-side routing on direct URL navigation.
- **S3**: AWS Simple Storage Service — an object store used here to host the compiled static files that CloudFront serves.
- **OIDC (OpenID Connect) role assumption**: A mechanism allowing GitHub Actions to obtain short-lived AWS credentials by exchanging a GitHub-issued identity token, eliminating the need to store long-lived AWS access keys as secrets.
- **CloudFront invalidation**: A request sent to CloudFront telling it to purge cached files. Required after deploying new static files so that the CDN serves the updated version rather than a stale cached copy.
- **Terraform**: An infrastructure-as-code tool. Used here for a one-time manual provisioning run to create AWS and GitHub resources; it is not run in CI.
- **OIDC provider ARN**: The AWS resource identifier for the GitHub Actions OIDC identity provider that must be registered in an AWS account before OIDC role assumption can work.
- **Vite**: The build tool underlying SvelteKit. Provides the dev server, plugin system, and env variable handling (`import.meta.env.VITE_*`).
- **`VITE_API_URL`**: A Vite build-time environment variable. Values prefixed with `VITE_` are statically inlined into the compiled JS bundle at build time, making the API base URL configurable per deployment without runtime configuration.
- **pnpm workspace**: A monorepo feature of pnpm that links multiple packages together so they can depend on each other locally. `web/` is added as a new workspace member alongside `api/`.
- **`adapter-static` fallback (`404.html`)**: When SvelteKit builds with `fallback: '404.html'`, it generates a copy of the app shell as `404.html`. CloudFront is configured to serve this file (with HTTP 200) for any 404 or 403, which lets the SvelteKit client-side router handle the URL.
- **Conflict detection**: Game mechanic where two different cipher letters are both guessed as the same plain letter. This is invalid (a cryptoquip cipher is one-to-one), so affected cells are highlighted in amber.

## Architecture

A static SPA built with Svelte 5 + SvelteKit, deployed to AWS S3 + CloudFront. The application has three URL routes (`/`, `/game`, `/stats`) — the onboarding flow is managed as client-side state within `/` before navigating to `/game`.

### Project Structure

```
web/
├── package.json           # @unquote/web, pnpm workspace member
├── svelte.config.js       # adapter-static, fallback: '404.html', trailingSlash: 'never'
├── vite.config.ts         # @tailwindcss/vite + @sveltejs/kit plugin
├── tsconfig.json
└── src/
    ├── app.css            # @import "tailwindcss" + @theme tokens + Google Fonts
    ├── app.html           # HTML shell
    ├── lib/
    │   ├── api.ts                    # typed fetch wrappers around VITE_API_URL
    │   ├── storage.ts                # localStorage abstraction (typed key registry + serialization)
    │   ├── puzzle.ts                 # pure domain logic: build cells, detect conflicts, format timer
    │   └── state/
    │       ├── identity.svelte.ts    # claim code + onboarding status, synced to localStorage
    │       └── game.svelte.ts        # puzzle data, guesses, timer, game status
    └── routes/
        ├── +layout.svelte            # root layout: onNavigate view transitions
        ├── +page.svelte              # / — landing + onboarding state machine
        ├── game/
        │   ├── +page.ts              # load: guard (→ / if not onboarded) + fetch puzzle
        │   └── +page.svelte          # game screen
        └── stats/
            ├── +page.ts              # load: fetch /player/:code/stats if claim code present
            └── +page.svelte          # stats screen
```

### Routing

Three URL routes. The onboarding state machine lives inside `/`, cycling through steps (`landing | choose | registering | registered | enter-code`) before calling `goto('/game')`. The `/game` load function checks `localStorage` for `unquote_has_onboarded` and throws `redirect(302, '/')` if absent.

Page transitions use the View Transitions API via `onNavigate` in `+layout.svelte` — progressive enhancement, degrades gracefully on non-Chromium browsers.

SvelteKit adapter-static is configured with `fallback: '404.html'` and `trailingSlash: 'never'`. CloudFront error pages redirect 404 and 403 to `/404.html` with HTTP 200, enabling client-side routing on direct navigation.

### State Management

Two Svelte 5 class-based state modules with `$state` fields, imported directly by components:

**`lib/state/identity.svelte.ts`** — claim code + onboarding status, hydrated from localStorage on module load:

```typescript
interface IdentityState {
  claimCode: string | null;   // null = anonymous
  hasOnboarded: boolean;      // true once any onboarding path completes
  // setClaimCode(code: string): void
  // setSkipped(): void
  // clear(): void
}
```

**`lib/state/game.svelte.ts`** — puzzle + in-progress game state:

```typescript
interface GameState {
  puzzle:        Puzzle | null;
  guesses:       Record<string, string>;  // cipherLetter → plainLetter
  startTime:     number | null;           // epoch ms
  status:        'idle' | 'playing' | 'checking' | 'solved';
  cursorEditIdx: number;
  // Derived:
  cells:     Cell[];   // full cell array built from puzzle + guesses
  editables: Cell[];   // letter-kind cells only
  progress:  number;   // 0–1, filled editables / total editables
}
```

Pure domain logic (building cells from puzzle + guesses, detecting conflicts, formatting the timer as MM:SS) lives in `lib/puzzle.ts` as plain functions — no reactivity, fully unit-testable.

### localStorage Strategy

Two keys only:

- `unquote_claim_code` — raw string
- `unquote_puzzle` — JSON-serialized `StoredPuzzleState` with date discriminator

```typescript
interface StoredPuzzleState {
  date:      string;                    // YYYY-MM-DD — the discriminator
  puzzleId:  string;
  guesses:   Record<string, string>;
  startTime: number | null;             // epoch ms, for timer resume
  status:    'playing' | 'solved';
}
```

On game load: if `stored.date !== today`, discard and fetch fresh puzzle. Timer resumes from `startTime` on reload within the same puzzle day. `lib/storage.ts` is a thin typed wrapper with a key registry — no raw `localStorage` calls outside this module.

### API Layer

Thin typed fetch wrapper in `lib/api.ts`. Four functions, one per endpoint:

```typescript
// Base: import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

getToday(): Promise<Puzzle>
checkSolution(id: string, solution: string): Promise<CheckResult>
registerPlayer(): Promise<{ claimCode: string }>
getStats(claimCode: string): Promise<PlayerStats>
```

No TanStack Query. `/game/today` is fetched once and stored in `unquote_puzzle`; subsequent same-day loads rehydrate from localStorage without hitting the API. Stats are fetched on demand only when a claim code is present. Fetch errors surface as `game.status = 'error'` with a user-visible message.

### Design Tokens

Tailwind v4 `@theme` block in `src/app.css` defines all solid colors and fonts, generating both CSS custom properties and Tailwind utility classes (e.g., `bg-surface`, `text-gold`, `font-mono`). Alpha-channel variants (glow overlays, semi-transparent borders) are defined as regular `:root` CSS custom properties, since Tailwind cannot generate meaningful utilities from `rgba()` values.

Color system: gold (primary action/focus), teal (cipher labels/hints), green (correct/solved), amber (conflict), red (error). Three fonts: Cormorant Garamond (display/quotes), Space Mono (monospace/cipher), DM Sans (UI/body).

### Game Mechanics

The game screen replicates the prototype faithfully:

- **Keyboard capture**: hidden off-screen `<input>` focused on game mount and on any click in the game area
- **Input**: letter key fills current cell + advances cursor; Backspace deletes or moves back; Arrow keys navigate; Enter submits; Ctrl+C clears all
- **Related highlighting**: all cells sharing the same cipher letter highlight when one is active
- **Conflict detection**: two different cipher letters mapped to the same plain letter → amber highlight on both
- **Hint cells**: pre-revealed in teal, not editable
- **Progress bar**: filled editables / total editables, updates on every keystroke
- **Solve animation**: staggered green flip animation across cells, then solved card with decoded quote, attribution, and elapsed time

### Infrastructure

`infra/web/` is a Terraform module (one-time manual run, not in CI) that creates:

- S3 bucket with static website hosting enabled
- CloudFront distribution with S3 website endpoint as origin, 404/403 error pages → `/404.html` (HTTP 200)
- IAM role `github-web-deploy` trusted by GitHub Actions OIDC, scoped to `repo:owner/unquote:ref:refs/heads/main`
- GitHub Actions variables (`S3_BUCKET`, `CF_DISTRIBUTION_ID`, `AWS_ACCOUNT_ID`, `API_URL`) via the GitHub Terraform provider

Required variables (`github_oidc_provider_arn`, `api_url`) supplied via gitignored `terraform.tfvars`; a `terraform.tfvars.example` with placeholder values is committed.

### CI/CD

`web-deploy.yml` triggers on push to `main` with changes in `web/**`:

1. Checkout + pnpm install
2. `pnpm -F @unquote/web build` with `VITE_API_URL` from GitHub Actions var
3. Assume `github-web-deploy` IAM role via OIDC (no long-lived credentials)
4. `aws s3 sync web/build s3://$S3_BUCKET --delete`
5. `aws cloudfront create-invalidation --paths "/*"`

## Existing Patterns

Investigation found no existing web frontend in the repository. This design introduces the `web/` package as a new monorepo member alongside the existing `api/` and `tui/` packages.

The following patterns are adopted from existing code:

- **pnpm workspace integration**: mirrors `api/` structure — `package.json` with `@unquote/web` name, added to `pnpm-workspace.yaml`
- **GitHub Actions CI shape**: `web-deploy.yml` reuses the same `pnpm/action-setup`, `actions/setup-node` with `cache: 'pnpm'`, and `actions/checkout` patterns from `api-release.yml` and `tui-release.yml`
- **Conventional commit scopes**: `web` scope added following the existing `api` and `tui` scope convention
- **mise task naming**: `//web:build` added following the existing `//api:build` and `//tui:build` pattern

The Terraform module in `infra/web/` is new — no existing IaC exists in the repository (current `k8s/local/` is local-dev-only Kubernetes manifests).

## Implementation Phases

<!-- START_PHASE_1 -->
### Phase 1: Terraform Infrastructure

**Goal:** Provision all AWS and GitHub resources needed for deployment. One-time manual run; no CI dependency.

**Components:**
- `infra/web/main.tf` — S3 bucket, CloudFront distribution, IAM role, GitHub Actions variables
- `infra/web/variables.tf` — `github_oidc_provider_arn`, `api_url` inputs
- `infra/web/outputs.tf` — bucket name, distribution ID
- `infra/web/providers.tf` — AWS + GitHub provider configuration
- `infra/web/terraform.tfvars.example` — committed placeholder file
- `infra/web/.gitignore` — ignores `terraform.tfvars`, `.terraform/`, state files

**Dependencies:** None (first phase). Requires AWS credentials and GitHub token locally at apply time.

**Done when:** `terraform apply` succeeds; S3 bucket and CloudFront distribution exist in AWS; GitHub Actions variables `S3_BUCKET`, `CF_DISTRIBUTION_ID`, `AWS_ACCOUNT_ID`, `API_URL` are set on the repository.
<!-- END_PHASE_1 -->

<!-- START_PHASE_2 -->
### Phase 2: SvelteKit Project Scaffold

**Goal:** Establish the `web/` package with all tooling configured. Project builds and dev server starts.

**Components:**
- `web/package.json` — `@unquote/web`, dev/build scripts, Svelte 5 + SvelteKit + Tailwind v4 + TypeScript dependencies
- `web/svelte.config.js` — adapter-static with `fallback: '404.html'`, `trailingSlash: 'never'`
- `web/vite.config.ts` — `@tailwindcss/vite` + `@sveltejs/kit/vite` plugins
- `web/tsconfig.json` — TypeScript config extending SvelteKit defaults
- `web/src/app.css` — `@import "tailwindcss"`, `@theme` block with full color + font token set, `:root` alpha-channel variants
- `web/src/app.html` — HTML shell with Google Fonts preconnect and `<link>`
- `web/src/routes/+layout.svelte` — root layout importing `app.css`, `onNavigate` view transition hook
- `web/src/routes/+page.svelte` — minimal placeholder (renders "Unquote")
- `pnpm-workspace.yaml` — `web` added to packages list
- `mise.toml` — `//web:build` and `//web:dev` tasks added

**Dependencies:** None (can scaffold without Phase 1 infra).

**Done when:** `pnpm -F @unquote/web dev` starts without errors; `pnpm -F @unquote/web build` produces output in `web/build/`; design tokens visible (spot-check `bg-gold` utility in a test element).
<!-- END_PHASE_2 -->

<!-- START_PHASE_3 -->
### Phase 3: Core State and Storage Layer

**Goal:** All shared state, storage abstraction, API client, and domain logic in place. No UI yet.

**Components:**
- `web/src/lib/storage.ts` — typed key registry (`unquote_claim_code`, `unquote_puzzle`), `get`/`set`/`remove` wrappers
- `web/src/lib/api.ts` — `getToday()`, `checkSolution()`, `registerPlayer()`, `getStats()` typed fetch wrappers; `VITE_API_URL` base
- `web/src/lib/puzzle.ts` — `Cell` and `Puzzle` types; `buildCells()`, `detectConflicts()`, `formatTimer()` pure functions
- `web/src/lib/state/identity.svelte.ts` — `IdentityState` class with `$state` fields, localStorage hydration on init, `setClaimCode()`, `setSkipped()`, `clear()` methods
- `web/src/lib/state/game.svelte.ts` — `GameState` class with `$state` fields and `$derived` cells/editables/progress; localStorage persistence on mutation

**Dependencies:** Phase 2 (project scaffold).

**Done when:** Unit tests pass for `puzzle.ts` pure functions (cell building, conflict detection, timer formatting); `storage.ts` read/write/remove round-trips correctly; `identity.svelte.ts` and `game.svelte.ts` hydrate from and persist to localStorage correctly in tests.
<!-- END_PHASE_3 -->

<!-- START_PHASE_4 -->
### Phase 4: Landing and Onboarding Flow

**Goal:** The `/` route implements the complete first-time user flow. New users can register, skip, or link an existing account before reaching the game.

**Components:**
- `web/src/routes/+page.svelte` — state machine (`landing | choose | registering | registered | enter-code`) with Svelte transitions between steps; calls `registerPlayer()`, `identity.setClaimCode()`, `identity.setSkipped()`, `goto('/game')`
- Animated demo cells on the landing step (mirrors prototype)
- Claim code ticket card on `registered` step with copy-to-clipboard
- Claim code input field on `enter-code` step with `WORD-WORD-0000` format validation

**Dependencies:** Phase 3 (state + API layer).

**Done when:** All onboarding paths navigate to `/game`; claim code is persisted to `unquote_claim_code` in localStorage after registration or linking; `unquote_has_onboarded` is set on skip; screen transitions animate correctly; all onboarding.AC criteria pass.
<!-- END_PHASE_4 -->

<!-- START_PHASE_5 -->
### Phase 5: Game Screen

**Goal:** The `/game` route fully implements the cryptoquip puzzle experience, matching prototype behavior.

**Components:**
- `web/src/routes/game/+page.ts` — load function: guard redirect to `/` if not onboarded; check `unquote_puzzle` localStorage; fetch `getToday()` if stale or absent; hydrate `game` state
- `web/src/routes/game/+page.svelte` — full game UI: puzzle grid (cell rendering by kind: letter/hint/punct/space), keyboard capture input, timer display, progress bar, clue chips, game meta bar (date, difficulty badge), conflict detection rendering, solve animation, solved card

**Dependencies:** Phase 4 (onboarding must complete before game is accessible).

**Done when:** All game.AC criteria pass — puzzle loads, keyboard navigation works, conflict detection highlights correctly, timer resumes on reload, solve animation triggers on correct submission, solved card displays decoded quote and elapsed time.
<!-- END_PHASE_5 -->

<!-- START_PHASE_6 -->
### Phase 6: Stats Screen

**Goal:** The `/stats` route displays player statistics for users with a claim code; shows an appropriate empty state for anonymous players.

**Components:**
- `web/src/routes/stats/+page.ts` — load function: fetch `getStats(identity.claimCode)` if claim code present; return null stats for anonymous users
- `web/src/routes/stats/+page.svelte` — 4 primary stat tiles (played, solved, win rate, streak), SVG line chart (last 30 days solve times), secondary stat rows (best/average time, best/current streak), claim code display

**Dependencies:** Phase 5 (game screen; stats navigation comes from the game header).

**Done when:** Stats screen renders correctly for both authenticated (claim code present) and anonymous users; SVG chart renders without errors for sparse data (gaps between solve dates); all stats.AC criteria pass.
<!-- END_PHASE_6 -->

<!-- START_PHASE_7 -->
### Phase 7: CI/CD Deployment Workflow

**Goal:** Merges to `main` that touch `web/**` automatically build and deploy to S3/CloudFront.

**Components:**
- `.github/workflows/web-deploy.yml` — trigger on `push` to `main` with `paths: ['web/**']`; pnpm install + build with `VITE_API_URL` from GitHub var; OIDC credential assumption; `aws s3 sync`; CloudFront invalidation

**Dependencies:** Phase 1 (Terraform infra must be applied), Phase 2 (project must build).

**Done when:** A commit touching `web/` merges to `main` and the workflow runs successfully; CloudFront serves the updated build at the distribution URL.
<!-- END_PHASE_7 -->

## Additional Considerations

**"Finish prior puzzle" feature:** The API supports `GET /game/:date` and `POST /player/:code/session` for historical dates. A natural follow-on: detect an unfinished prior puzzle in localStorage and offer a non-intrusive prompt to complete it before starting today's. Out of scope for this implementation; storage and API layers are designed to support it without restructuring.

**PWA:** Out of scope. A native mobile app is planned separately.

**Beta/staging distribution:** Out of scope. A single production distribution is sufficient. Testing happens locally against `localhost:3000`.

**Frontend release tagging:** Not needed. The web frontend is always "latest" — there are no pinned-version semantics as with the API (where the TUI pins to specific API contracts).

## Post-Design-Phase Changes

### Additions

**`lib/claim-code.ts` -- dedicated claim code validation module.** The design placed claim code validation inline in `+page.svelte`. The implementation extracted it into a standalone module (`web/src/lib/claim-code.ts`) with a `validateClaimCode()` function and its own test file (`web/src/lib/claim-code.test.ts`). This improves testability and reusability.

**`lib/puzzle.ts: assembleSolution()` function.** The design listed `buildCells()`, `detectConflicts()`, and `formatTimer()` as the pure functions in `lib/puzzle.ts`. The implementation added `assembleSolution()` -- a pure function that reconstructs the full plaintext from the cell array for submission to `POST /game/:id/check`. The game screen calls this instead of performing inline string assembly.

**`api.ts: recordSession()` function.** The design specified four API functions (`getToday`, `checkSolution`, `registerPlayer`, `getStats`). The implementation added a fifth, `recordSession(claimCode, gameId, completionTime)`, which calls `POST /player/:code/session` to record a completed game. This is called fire-and-forget from the game screen on solve; failures are silently ignored.

**`StoredPuzzleState.puzzle` -- full puzzle data cached in localStorage.** The design's `StoredPuzzleState` interface included `date`, `puzzleId`, `guesses`, `startTime`, and `status`. The implementation added a nested `puzzle` object containing the full `PuzzleResponse` fields (`id`, `encryptedText`, `hints`, `author`, `category`, `difficulty`). This allows same-day reloads to skip the API call entirely by reconstructing the puzzle from localStorage without fetching `/game/today` (AC4.2).

**`StoredPuzzleState.completionTime` field.** The design's stored state had no `completionTime`. The implementation added it to persist the exact elapsed time at solve, so the solved card shows the correct time after a page reload.

**`GameState.errorMessage` and `GameState.conflicts` derived fields.** The design specified `cells`, `editables`, and `progress` as derived state. The implementation added `conflicts` (a `$derived` `Set<string>` from `detectConflicts()`) and `errorMessage` (a `$state<string | null>` for user-visible error messages).

**`+layout.ts` for global SvelteKit options.** The design placed `trailingSlash: 'never'` in `svelte.config.js`. The implementation instead uses a `+layout.ts` file at the route root that exports `prerender = true` and `trailingSlash = "never"` as SvelteKit layout-level options.

**`+page.ts` on the `/` route (onboarding redirect guard).** The design described the `/game` load function redirecting unonboarded users to `/`. The implementation also added a `/` route load function (`src/routes/+page.ts`) that redirects already-onboarded users to `/game`, preventing them from seeing the landing page again.

**Vitest configuration with jsdom and `$app/environment` mock.** The design mentioned unit tests but did not specify test infrastructure. The implementation added `vitest.config.ts` (jsdom environment, `$lib` path alias, `$app/environment` mock) and `vitest.setup.ts` (exports `browser = true`, `dev = false`, `building = false`). Tests cover `puzzle.ts`, `storage.ts`, `claim-code.ts`, `identity.svelte.ts`, and `game.svelte.ts`.

**Vite `rollupOptions.manualChunks` -- single-chunk bundling.** The implementation's `vite.config.ts` forces all code into a single `"app"` chunk (`manualChunks: () => "app"`). This was not in the design but optimizes loading for the small bundle size (~46 KB gzipped).

**Infrastructure: Route 53 domain registration, ACM certificate, DNS records, and WAF.** The design specified S3 + CloudFront + IAM role + GitHub Actions variables. The implementation's Terraform module (`infra/web/main.tf`) additionally manages:
- `aws_route53domains_domain.web` -- domain registration for `playunquote.com`
- `aws_acm_certificate.web` + DNS validation records -- TLS certificate for the custom domain
- `aws_route53_record.web_a` and `web_aaaa` -- A/AAAA alias records pointing the domain at CloudFront
- `aws_wafv2_web_acl.web` -- WAF Web ACL with AWS managed common rule set, attached to the CloudFront distribution
- `aws_cloudfront_origin_access_control.web` -- OAC instead of the legacy OAI pattern

**Infrastructure: CloudFront uses OAC with private S3 bucket.** The design described "S3 bucket with static website hosting enabled." The implementation uses a private S3 bucket (all public access blocked via `aws_s3_bucket_public_access_block`) accessed by CloudFront through Origin Access Control (OAC). This is a security improvement over public S3 website endpoints.

**Infrastructure variables: `domain_name`, `domain_contact`, `github_repo`, `aws_region`.** The design specified only `github_oidc_provider_arn` and `api_url` as Terraform variables. The implementation added `domain_name` (default `playunquote.com`), `domain_contact` (sensitive, for WHOIS registration), `github_repo` (default `unquote`), and `aws_region` (default `us-east-1`).

**Infrastructure outputs expanded.** The design listed bucket name and distribution ID as outputs. The implementation added: `cloudfront_domain_name`, `github_deploy_role_arn`, `waf_web_acl_arn`, `domain_name`, `hosted_zone_id`, `hosted_zone_nameservers`, and `acm_certificate_arn`.

**CI workflow: mise setup and differentiated cache headers.** The design described a simple build-and-sync workflow. The implementation's `web-deploy.yml` additionally:
- Uses `jdx/mise-action` to install mise and runs `corepack enable` for pnpm
- Splits S3 sync into two passes: immutable assets (`max-age=31536000, immutable`) and HTML files (`max-age=0, must-revalidate`)
- Includes `concurrency` settings to prevent mid-sync cancellation
- Triggers on both `web/**` and `.github/workflows/web-deploy.yml` changes
- Uses pinned action SHAs (not tags) for security

**CI workflow: `permissions` block at workflow and job level.** The workflow sets top-level `permissions: {}` and only grants `contents: read` and `id-token: write` at the job level, following least-privilege.

**`infra/mise.toml` -- OpenTofu tool for IaC.** The design did not mention a mise config for infrastructure. The implementation added `infra/mise.toml` specifying `opentofu = "latest"` as the Terraform alternative.

**`web/mise.toml` with full task set.** The design mentioned adding `//web:build` and `//web:dev` tasks. The implementation added a comprehensive `web/mise.toml` with tasks for `install`, `dev`, `build`, `preview`, `lint`, `typecheck`, `fmt`, and `ci`.

**Game screen: word-group rendering.** The design described a puzzle grid with cells. The implementation groups cells into "words" by splitting on `SpaceCell` boundaries (`wordGroups` derived), rendering each word as a `<div class="puzzle-word">` with `flex-wrap` on the grid. This produces natural word-wrap behavior.

**Game screen: keyboard hints bar.** The implementation renders a keyboard hints bar below the submit button showing key bindings (`Enter` submit, `Backspace` delete, arrow navigate, `Ctrl+C` clear). This was not in the design.

**Game screen: difficulty badge with 4-tier color system.** The implementation maps the difficulty score to four labels with distinct color schemes (Easy/green, Medium/gold, Hard/amber, Expert/red) via the `diffInfo()` function. The design mentioned a "difficulty badge" but did not specify the tier breakdown.

**Stats screen: CTA for anonymous users.** The design's AC4.6 required showing an empty state when no claim code is present. The implementation goes further: the stats screen shows a "create account" CTA button that navigates to `/` for anonymous users, instead of simply stating "no stats available."

### Deviations

**`web/` is a standalone pnpm project, not a pnpm workspace member.** The design stated that `web/` would be "added to `pnpm-workspace.yaml`" as a workspace member alongside `api/`. In the implementation, `web/` has its own `package.json` but is not referenced in `api/pnpm-workspace.yaml`. It operates as an independent pnpm project. The root `mise.toml` references it as a monorepo config root, but pnpm workspace linking is not used.

**`storage.ts` uses three keys, not two.** The design specified "two localStorage keys only" (`unquote_claim_code`, `unquote_puzzle`). The implementation adds a third key, `unquote_has_onboarded`, to track onboarding completion independently of the claim code. This is necessary because anonymous (skipped) users have no claim code but still need the onboarding flag to bypass the landing page.

**`svelte.config.js` omits `trailingSlash` setting.** The design specified `svelte.config.js` would include `trailingSlash: 'never'`. The implementation moves this to `src/routes/+layout.ts` as an exported constant, which is an equivalent SvelteKit mechanism but in a different file.

**Game screen error handling stays in-page.** The design specified that fetch failures would set `game.status = 'error'`. The implementation does this via a `try/catch` in the load function that sets `game.status` and `game.errorMessage` directly rather than throwing a SvelteKit error, keeping error handling in-page rather than using SvelteKit's error boundary.

**No `lib/components/` directory.** The design's project structure listed components under `src/lib/`. The implementation places all UI directly in route `+page.svelte` files with scoped `<style>` blocks and global styles in `app.css`. No shared component files were extracted.

**Solve animation uses CSS `scaleY` flip, not per-cell green fill.** The design described "staggered green flip animation." The implementation uses a CSS `@keyframes flipReveal` animation with `scaleY(1) -> scaleY(0.05) -> scaleY(1)` and staggered delay via `calc(var(--edit-idx) * 28ms)`, followed by a cross-fade from the grid to a solved card.

**Stats screen secondary stats use grouped cards.** The design described "secondary stat rows." The implementation organizes them into two side-by-side cards (Streaks: current/best; Times: best/average) in a 2-column grid.

**Infrastructure uses OpenTofu, not Terraform.** The design referred to "Terraform" throughout. The implementation uses the OpenTofu fork (compatible provider and HCL syntax).

### Deferred

**`lib/components/` shared component library.** The implementation inlines all UI into route-level `+page.svelte` files. Common patterns (compact header, buttons) are repeated via CSS classes in `app.css` rather than Svelte components. This may be refactored as the UI grows.

**Precompression of static assets.** The `svelte.config.js` explicitly sets `precompress: false`. CloudFront handles compression via its `compress: true` setting, but precompressing assets could improve initial response times.

**Unit tests for `lib/api.ts`.** The pure domain logic and state modules all have tests. The API client has no unit tests -- API communication is validated through manual testing.
