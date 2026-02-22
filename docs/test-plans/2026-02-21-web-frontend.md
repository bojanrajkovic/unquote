# Web Frontend — Human Test Plan

Generated from implementation plan: `docs/implementation-plans/2026-02-21-web-frontend/`

## Prerequisites

- Node.js 24+ and pnpm 10 installed (or `mise` configured)
- The API server running locally at `http://localhost:3000` with a valid `QUOTES_FILE_PATH` and optionally `DATABASE_URL` for player stats
- From the `web/` directory: `pnpm install && pnpm run dev` (dev server at `http://localhost:5173`)
- All automated tests passing: `pnpm run test` shows 72/72 pass

---

## Phase 4: Landing and Onboarding Flow

| Step | Action | Expected |
|------|--------|----------|
| 4.1 | Open `http://localhost:5173` in a fresh browser session (clear localStorage or use incognito) | Landing screen renders with animated demo cells appearing one-by-one (approximately 800ms delay, 380ms stagger between cells), a tagline "Each day, a new quote -- encrypted...", and a "Play Today's Puzzle" button |
| 4.2 | Watch the demo cell animation closely | Cipher letters should visually "decode" into plain letters with a flip or transition effect |
| 4.3 | Click "Play Today's Puzzle" | The `choose` step renders with three choice cards: "Yes -- create an account", "No thanks, just play", "I already have a claim code". Each card has an icon, title, description, and arrow indicator |
| 4.4 | Click "Yes -- create an account" | A spinner appears with "Creating your account..." text |
| 4.5 | Wait for registration to complete | A ticket card appears with a green-bordered claim code in `WORD-WORD-0000` format |
| 4.6 | Click "Copy Code" on the ticket | Clipboard contains the claim code. Button text changes to "Copied" for approximately 2 seconds, then reverts |
| 4.7 | Click "Play Today's Puzzle" on the ticket card | Browser navigates to `/game` |
| 4.8 | Open DevTools > Application > Local Storage > `http://localhost:5173` | `unquote_claim_code` contains the code from step 4.5. `unquote_has_onboarded` is `"true"` |
| 4.9 | Clear localStorage, reload `/`, click "Play Today's Puzzle", then click "No thanks, just play" | Browser navigates to `/game`. In localStorage: `unquote_has_onboarded` is `"true"`, `unquote_claim_code` is NOT present |
| 4.10 | Clear localStorage, reload `/`, click "Play Today's Puzzle", then click "I already have a claim code" | The `enter-code` step renders with a text input field and a "Link Account" button |
| 4.11 | Type `AMBER` into the code input and click "Link Account" (or press Enter) | Inline error message appears: "Code must be in WORD-WORD-0000 format". User remains on the `enter-code` step. No navigation occurs |
| 4.12 | Clear the input, type a valid code (e.g., `AMBER-HAWK-7842`), and click "Link Account" | Browser navigates to `/game`. `unquote_claim_code` is set in localStorage to the entered code |
| 4.13 | Clear localStorage, navigate directly to `http://localhost:5173/game` | Immediate redirect to `/` (landing step) |
| 4.14 | Complete onboarding via "Skip", then navigate to `http://localhost:5173/game` | Game screen loads without redirect |
| 4.15 | On the `choose` step, use Tab to focus each choice card | A visible focus indicator (ring or outline) appears on each focused card |
| 4.16 | Press Enter on a focused choice card | The corresponding action triggers (e.g., registration starts for "Yes" card) |
| 4.17 | Navigate back, Tab to a different card, press Space | That card's action triggers as well |
| 4.18 | Inspect a choice card in DevTools > Elements | Card has `role="button"` and `tabindex="0"` attributes |

---

## Phase 5: Game Screen

| Step | Action | Expected |
|------|--------|----------|
| 5.1 | Complete onboarding and arrive at `/game` | Puzzle grid renders with cipher letters above each cell. Clue chips in "Clues" bar show `CIPHER -> PLAIN` pairs. Difficulty badge shows "Difficulty: N%". Timer shows `00:00`. Progress bar at 0%. "Check Answer" button present |
| 5.2 | Note the active cell (gold underline), type a letter key (e.g., `A`) | The letter appears in the active cell. Cursor advances to the next editable cell |
| 5.3 | At the last editable cell, type another letter | Cursor stays on the last cell (does not wrap) |
| 5.4 | Press Backspace on a filled cell | Letter is cleared. Cursor stays on that cell |
| 5.5 | Press Backspace again (cell now empty) | Cursor moves to the previous cell and that cell's content is cleared |
| 5.6 | Press ArrowRight repeatedly | Cursor moves through editable cells. At the last editable cell, cursor stays (boundary) |
| 5.7 | Press ArrowLeft repeatedly | Cursor moves backward. At the first editable cell, cursor stays (boundary) |
| 5.8 | Click on any editable cell in the grid | Clicked cell becomes active (gold underline/glow). Typing a letter fills that cell |
| 5.9 | Navigate to an editable cell and observe other cells with the same cipher letter | All cells sharing the same cipher letter show a dim gold glow (`.related` CSS class). Navigating to a different cipher letter updates highlighting |
| 5.10 | Enter the same plain letter for two different cipher letters (e.g., type `E` for both cipher `X` and cipher `Y`) | Both sets of cells turn amber (`.conflict` CSS class) |
| 5.11 | Change one conflicting guess to a different letter | Amber highlighting clears |
| 5.12 | Identify hint cells (pre-filled, teal styling) | Hint cells display teal-colored cipher label and plain letter. Clicking a hint cell does not make it active. Keyboard navigation skips hint cells |
| 5.13 | Type several letters; observe progress bar | Progress bar fills proportionally (e.g., 5 of 50 cells filled shows approximately 10%). Clearing a cell with Backspace decreases progress. Ctrl+C returns progress to 0% |
| 5.14 | Fill several cells, then press Ctrl+C | All editable cells are cleared. Progress bar returns to 0% |
| 5.15 | Leave some cells unfilled, press Enter (or click "Check Answer") | Warning message "Fill in all letters first." appears. No API call to POST `/game/:id/check` (verify in Network tab) |
| 5.16 | Fill all cells but create a conflict (two cipher letters mapped to same plain letter), press Enter | Warning message "Resolve letter conflicts first." appears. No API call made |
| 5.17 | Fill all cells with an incorrect answer (no conflicts), press Enter | "Checking..." status appears, POST `/game/{id}/check` is called (Network tab). Error message "Not quite -- keep trying." appears. User can continue editing. Timer keeps running |
| 5.18 | Fill all cells with the correct solution, press Enter | Green flip animation plays staggered across cells (left to right, approximately 28ms delay per cell). After animation: solved card appears with fade-up, showing decoded quote in quotation marks, author attribution, elapsed time in MM:SS format. "Stats" link appears in header. "Check Answer" button is disabled and shows "Decoded" |
| 5.19 | Tab through the page until a puzzle cell receives browser focus | Visible focus ring appears. Pressing Enter on the focused cell activates it for keyboard input. Space also activates a focused cell |
| 5.20 | With the hidden input focused, press Tab | Cursor advances to the next editable cell (same as ArrowRight). Shift+Tab moves to the previous. Both stop at boundaries |
| 5.21 | Click somewhere outside the puzzle grid but within the game screen (e.g., on the meta bar) | Typing a letter still fills the active cell (hidden input was re-focused). Click browser URL bar to blur, click back in game area, type -- keyboard input works |

### Phase 5: State Persistence

| Step | Action | Expected |
|------|--------|----------|
| 5.22 | Enter several letters on the game screen, then reload the page (F5) | Previously entered letters are still displayed in their cells |
| 5.23 | Play for approximately 30 seconds (timer shows ~00:30), reload the page | Timer resumes from approximately the same elapsed time (not 00:00) |
| 5.24 | Enter some letters, open DevTools > Application > Local Storage, edit the `unquote_puzzle` key's `date` field to `2026-02-20`, reload | Puzzle starts fresh with no prior guesses and timer at 00:00 |

### Phase 5: API Communication

| Step | Action | Expected |
|------|--------|----------|
| 5.25 | Clear `unquote_puzzle` from localStorage, complete onboarding, navigate to `/game`. Open DevTools > Network | GET `/game/today` request made, returns HTTP 200. Puzzle grid renders with response data |
| 5.26 | Reload the page with DevTools > Network open | GET `/game/today` is NOT made (same-day puzzle is loaded from localStorage). Previously entered guesses are restored |
| 5.27 | Fill all cells correctly, press Enter. Observe Network tab | POST `/game/{id}/check` called with solution payload. Response `{ correct: true }` triggers solve animation and solved card |
| 5.28 | Set DevTools > Network to "Offline" mode. Clear `unquote_puzzle` from localStorage. Navigate to `/game` | Error message "Could not load today's puzzle. Check your connection and try again." displayed. "Back" link visible and functional. No unhandled JavaScript errors in console |

---

## Phase 6: Stats Screen

| Step | Action | Expected |
|------|--------|----------|
| 6.1 | Ensure a valid claim code is in localStorage (from a registered player with solve history). Navigate to `/stats` | GET `/player/{code}/stats` called (Network tab), returns HTTP 200. 4 primary tiles render: Played, Solved, Win Rate, Streak. SVG line chart renders with dots on solve days. Secondary stat rows: best streak, best time, avg time. Claim code display panel at bottom |
| 6.2 | With sparse data, inspect the SVG chart | Line segments do not connect across multi-day gaps |
| 6.3 | Delete `unquote_claim_code` from localStorage (or use private window after skipping onboarding). Navigate to `/stats` | Empty state message: "Stats are saved when you create an account." "Create account" button visible. No request to `/player/.../stats` in Network tab |
| 6.4 | Click the "create account" button on the empty stats screen | Navigation to `/` |

---

## Phase 7: CI/CD and Deployment

| Step | Action | Expected |
|------|--------|----------|
| 7.1 | Create a PR modifying a file under `web/`, merge to `main` | GitHub > Actions > "Web - Deploy" workflow triggers. All steps pass: checkout, install, build, OIDC, S3 sync, CloudFront invalidation. Completes within approximately 3 minutes |
| 7.2 | After successful deployment, open `https://<cloudfront-domain>/` | Latest build is served. Hard-refresh (Ctrl+Shift+R) if caching suspected |
| 7.3 | Navigate directly to `https://<cloudfront-domain>/game` in a new tab | App loads (SvelteKit client-side router handles URL). No 404 or 403 error. If not onboarded, redirect to `/` works |
| 7.4 | Build with custom API URL: `VITE_API_URL=https://custom-api.example.com pnpm run build` in `web/` | Open `web/build/_app/immutable/chunks/*.js` and search for `custom-api.example.com` -- URL is inlined in the bundle |
| 7.5 | Go to GitHub > Settings > Secrets and variables > Actions > Secrets | No `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` secrets exist |
| 7.6 | Inspect `.github/workflows/web-deploy.yml` | `aws-actions/configure-aws-credentials` uses `role-to-assume` (OIDC). Job has `permissions: { id-token: write }` |

---

## End-to-End: Full Player Registration and Solve Flow

**Purpose:** Validates the complete happy path from first visit through puzzle solve to stats viewing, spanning AC1, AC2, AC3, and AC4.

1. Open `http://localhost:5173` in an incognito window
2. Confirm landing screen with animation and "Play Today's Puzzle" button (AC1.1)
3. Click "Play Today's Puzzle" — confirm three choice cards appear (AC1.2)
4. Click "Yes — create an account" — confirm spinner, then ticket card with claim code (AC1.3)
5. Copy the claim code (verify clipboard), click "Play Today's Puzzle" (AC1.3)
6. Confirm `/game` loads with puzzle grid, timer at 00:00, progress at 0% (AC1.6, AC4.1)
7. Solve the puzzle using keyboard input — verify letter filling, cursor advancement, related highlighting, progress bar updates (AC2.1, AC2.7, AC2.10)
8. Press Enter with correct solution — verify green flip animation and solved card with quote, author, time (AC2.11, AC4.3)
9. Click "Stats" in the header — confirm stats screen loads with tiles, chart, and claim code panel (AC1.7, AC4.4)
10. Close the tab, reopen the app in a new tab — confirm no re-onboarding required (AC3.3)

## End-to-End: Anonymous Skip and Day Transition

**Purpose:** Validates the anonymous player path and day-boundary state reset, spanning AC1.5, AC3.4, and AC4.6.

1. Open the app in an incognito window
2. Click "Play Today's Puzzle", then "No thanks, just play"
3. Confirm `/game` loads, `unquote_has_onboarded` is `"true"`, no `unquote_claim_code` in localStorage (AC1.5)
4. Enter several letters and note the timer value
5. Reload — confirm guesses and timer persist (AC3.1, AC3.2)
6. Edit localStorage: change `unquote_puzzle` date to yesterday
7. Reload — confirm fresh start with empty guesses and timer at 00:00 (AC3.4)
8. Navigate to `/stats` — confirm empty state message with "create account" prompt (AC4.6)

---

## Traceability

| Acceptance Criterion | Automated Test | Manual Step |
|----------------------|----------------|-------------|
| AC1.1 Landing screen | — | 4.1–4.2 |
| AC1.2 Onboarding choices | — | 4.3 |
| AC1.3 Registration path | — | 4.4–4.8 |
| AC1.4 Enter claim code | `claim-code.test.ts` (6 tests) | 4.10–4.12 |
| AC1.5 Skip path | `identity.svelte.test.ts` setSkipped (3 tests) | 4.9 |
| AC1.6 Game screen layout | — | 5.1 |
| AC1.7 Stats screen | — | 6.1–6.2 |
| AC1.8 Redirect guard | — | 4.13–4.14 |
| AC1.9 Invalid claim code | `claim-code.test.ts` (6 tests) | 4.11 |
| AC1.10 Keyboard a11y | — | 4.15–4.18 |
| AC2.1 Letter key fill | — | 5.2–5.3 |
| AC2.2 Backspace | — | 5.4–5.5 |
| AC2.3 Arrow navigation | — | 5.6–5.7 |
| AC2.4 Enter submits | — | 5.17–5.18 |
| AC2.5 Ctrl+C clear | — | 5.14 |
| AC2.6 Click cursor | — | 5.8 |
| AC2.7 Related highlight | — | 5.9 |
| AC2.8 Conflict detection | `puzzle.test.ts` detectConflicts (9 tests) | 5.10–5.11 |
| AC2.9 Hint cells | — | 5.12 |
| AC2.10 Progress bar | — | 5.13 |
| AC2.11 Solve animation | — | 5.18 |
| AC2.12 Unfilled warning | — | 5.15 |
| AC2.13 Conflict warning | — | 5.16 |
| AC2.14 Incorrect submission | — | 5.17 |
| AC2.15 Tab focus cells | — | 5.19 |
| AC2.16 Tab/Shift+Tab | — | 5.20 |
| AC2.17 Click re-focus | — | 5.21 |
| AC3.1 Guesses persist | `game.svelte.test.ts` setGuess + load (3 tests) | 5.22 |
| AC3.2 Timer resumes | `game.svelte.test.ts` load startTime (1 test) | 5.23 |
| AC3.3 Claim code persists | `identity.svelte.test.ts` setClaimCode (4 tests) | E2E step 10 |
| AC3.4 New day fresh start | `game.svelte.test.ts` load date mismatch (2 tests) | 5.24 |
| AC3.5 Three storage keys | `storage.ts` STORAGE_KEYS + all state tests | — (compile-time + implicit) |
| AC4.1 GET /game/today | — | 5.25 |
| AC4.2 Same-day rehydration | `game.svelte.test.ts` readStored (3 tests) | 5.26 |
| AC4.3 POST /game/:id/check | — | 5.27 |
| AC4.4 GET /player/:code/stats | — | 6.1 |
| AC4.5 VITE_API_URL | — | 7.4 |
| AC4.6 Stats empty state | — | 6.3–6.4 |
| AC4.7 API error message | — | 5.28 |
| AC5.1 Deploy workflow | — | 7.1 |
| AC5.2 CloudFront serves build | — | 7.2 |
| AC5.3 Direct /game navigation | — | 7.3 |
| AC5.4 OIDC only | — | 7.5–7.6 |
