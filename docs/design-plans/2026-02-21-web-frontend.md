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
