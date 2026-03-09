# Human Test Plan: Shareable Stats

## Prerequisites
- Web dev server running (`cd web && pnpm run dev`)
- TUI binary built (`cd tui && go build -o bin/unquote ./main.go`)
- A registered player account (claim code in format `WORD-WORD-NNNN`)
- At least one solved puzzle recorded against the account (for stats share testing)
- Web unit tests passing: `cd web && pnpm run test` (share module: 43 tests in 4 files)
- TUI share tests passing: `cd tui && go test ./internal/share/... -v` (33 tests)
- E2E tests passing: `cd web && pnpm run test:e2e` (2 Playwright tests producing screenshot artifacts)

## Phase 1: Web Session Share (Post-Solve)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open `http://localhost:5173/game` in Chrome/Edge. Solve today's puzzle. | Solved card appears with decoded quote, time, and a "Share" button. |
| 2 | Verify "Share" button is visible on the solved card. | Button labeled "Share" appears below the time stat. |
| 3 | Click "Share". Verify dropdown menu options. | Dropdown shows: "Copy Image", "Copy Text", "Download PNG". If on mobile, also "Share...". |
| 4 | Click "Copy Text". Open a text editor and paste. | Pasted text contains: `UNQUOTE #YYYY-MM-DD` with checkmark emoji, time in M:SS, emoji grid of gold/white squares, streak line (if registered), and `playunquote.com` footer. |
| 5 | Click "Share" again. Click "Copy Image". Open an image-capable target (Discord, Slack, macOS Preview "New from Clipboard") and paste. | A 1200x628 branded PNG appears: navy background (#0c0c18), gold text, "UNQUOTE" wordmark at top, "SOLVED" status, completion time, letter grid, "playunquote.com" footer. Space Mono used for numbers, Cormorant Garamond for headings. |
| 6 | Click "Share" again. Click "Download PNG". | Browser downloads a `.png` file. Open it -- matches the share card layout from step 5. |
| 7 | Verify the Share button is NOT visible when game is unsolved. Navigate to `/game` on a day with no solve, or clear localStorage. | No "Share" button appears in the playing state. |
| 8 | Verify Share button is NOT visible for solved-elsewhere puzzles. Solve today's puzzle on another device (or simulate by setting `solvedElsewhere: true` in localStorage). Reload `/game`. | Solved-elsewhere card shows "Already Solved / Solved on another device" but NO Share button. |

## Phase 2: Web Session Share -- Clipboard Fallback

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open the app in Firefox (which lacks ClipboardItem API) or block clipboard permission in Chrome (Site Settings > Clipboard > Block). | |
| 2 | Solve a puzzle and click "Share" > "Copy Image". | Instead of copying to clipboard, a PNG file downloads. The feedback toast displays "Downloaded!" (not "Copied!"). |

## Phase 3: Web Stats Share

| Step | Action | Expected |
|------|--------|----------|
| 1 | Navigate to `http://localhost:5173/stats` as a registered player (claim code in localStorage). | Stats page shows: games played, solved, win rate, current streak tile, solve-time chart, streaks card, times card, and a "Share" button next to the heading. |
| 2 | Click "Share". Verify dropdown options are the same as session share. | Dropdown: "Copy Image", "Copy Text", "Download PNG", and optionally "Share..." on mobile. |
| 3 | Click "Copy Text". Paste into a text editor. | Text contains: `UNQUOTE Stats` header, games played/solved/win rate line, streak line, times line, `playunquote.com` footer. |
| 4 | Click "Share" again. Click "Copy Image". Paste into an image target. | 1200x628 branded stats card: navy background, stat values (matching the page), "UNQUOTE" wordmark, "playunquote.com" footer. |
| 5 | Click "Share" again. Click "Download PNG". | PNG file downloads. Contents match the stats share card. |
| 6 | Navigate to `/stats` as an anonymous player (clear `unquote_claim_code` from localStorage). | Empty state message: "Stats are saved when you create an account." with a "create account" link. NO Share button visible anywhere. |

## Phase 4: Web Native Share (Mobile)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open the app on iOS Safari or Android Chrome. Solve a puzzle. | Share dropdown appears on solved card. |
| 2 | Tap "Share" > "Share...". | Native OS share sheet opens with the share card image attached. |
| 3 | Share to a target app (Messages, Notes, etc.). | Image arrives at the target as a branded PNG. |
| 4 | Navigate to `/stats`. Tap "Share" > "Share...". | Native share sheet opens with the stats card image. |
| 5 | On a desktop browser (no Web Share API support). | "Share..." option does NOT appear in the dropdown menu. Only "Copy Image", "Copy Text", "Download PNG" are shown. |

## Phase 5: TUI Session Share

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `./bin/unquote` in a terminal. Solve today's puzzle. | Solved screen appears with decoded quote and time. |
| 2 | Press `c` on the solved screen. | Terminal shows "Copied!" feedback. On systems with clipboard support, the Wordle-style text is in the system clipboard. |
| 3 | Paste into a text editor. | Text contains: `UNQUOTE #YYYY-MM-DD` with checkmark emoji, time, letter grid, streak (if registered), `playunquote.com` footer. |
| 4 | Run in an SSH session or headless environment (no clipboard available). Press `c` on the solved screen. | Text is printed directly to stdout with an explanatory message. No error or crash. |
| 5 | As an anonymous player (no claim code), solve and press `c`. | Shared text omits the streak line entirely. |

## Phase 6: TUI Stats Share

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `./bin/unquote stats --share` as a registered player. | Terminal shows "Stats text copied to clipboard!" Stats text is in the system clipboard. |
| 2 | Paste the clipboard contents. | Text contains: `UNQUOTE Stats` header, games/solved/win rate, streak, times, `playunquote.com` footer. |
| 3 | Run `./bin/unquote stats --share --image`. | Terminal shows "Image copied to clipboard!" (if image clipboard available). If terminal supports inline images (kitty, iTerm2), a preview of the stats card appears inline. |
| 4 | Run `./bin/unquote stats --share` without a claim code (delete or rename `~/.config/unquote/config.json`). | Error message: "No claim code found. Run 'unquote register' first." Command exits with non-zero status. |
| 5 | Run `./bin/unquote stats --share` in an SSH/headless session. | Stats text printed to stdout instead of clipboard. |

## Phase 7: TUI Inline Terminal Image Display

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `./bin/unquote` in a kitty terminal. Solve puzzle, press `c`. | An inline image preview of the session share card appears in the terminal above the "Copied!" feedback. |
| 2 | Run in iTerm2. Same test. | Inline image appears via iTerm2 protocol. |
| 3 | Run in a basic terminal (GNOME Terminal, xterm, standard macOS Terminal.app). Press `c` on solved screen. | No image appears. No error is printed. Text copy proceeds normally with "Copied!" feedback. |

## End-to-End: Cross-Platform Share Consistency

**Purpose:** Verify that share text output is consistent between web and TUI for the same puzzle session.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Solve the same day's puzzle in both the web app and the TUI as the same registered player. | |
| 2 | Copy the session share text from the web (Click "Share" > "Copy Text"). | |
| 3 | Copy the session share text from the TUI (press `c` on solved screen). | |
| 4 | Compare the two outputs side by side. | Both contain the same structure: `UNQUOTE #<date>`, status emoji, time, letter grid, streak, footer URL. The letter grid should have the same gold/white pattern since the same cipher was decoded. |

## End-to-End: Share Card Branding Verification

**Purpose:** Verify visual branding consistency across all generated share card images.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Collect 4 images: web session card, web stats card (from "Copy Image" or "Download PNG"), TUI session card (`--image`), TUI stats card (`stats --share --image`). | |
| 2 | Open all 4 images side by side. | All share 1200x628 dimensions, dark navy (#0c0c18) background, "UNQUOTE" wordmark, "playunquote.com" footer. Numbers use Space Mono. Display headings use Cormorant Garamond. |

## Human Verification Required

| Criterion | Why Manual | Steps |
|-----------|------------|-------|
| AC1.4 -- Copy Image writes PNG blob to clipboard | ClipboardItem API requires secure context + user gesture + browser permission | Phase 1, Step 5 |
| AC1.5 -- Download PNG triggers browser download | Browser download behavior is OS/browser-specific | Phase 1, Step 6 |
| AC1.6 -- Share invokes Web Share API | `navigator.share()` invokes OS-level native share sheet requiring real mobile device | Phase 4, Steps 1-3 |
| AC1.10 -- Clipboard image fallback to download | Triggering real clipboard permission denial is browser-specific | Phase 2, Step 2 |
| AC2.4 -- All three distribution methods for stats | Same clipboard/download/share constraints as AC1.4/1.5/1.6 | Phase 3, Steps 3-5; Phase 4, Step 4 |
| AC3.5 -- Inline terminal image display | Terminal image protocols (kitty, sixel, iTerm2) require specific terminal emulators not available in CI | Phase 7, Steps 1-3 |

## Traceability

| Acceptance Criterion | Automated Test | Manual Step |
|----------------------|----------------|-------------|
| AC1.1 | `web/tests/share-cards.spec.ts` (session card screenshot) | Phase 1, Step 5 |
| AC1.2 | `web/tests/share-cards.spec.ts` (text content assertions) | Phase 1, Step 5 |
| AC1.3 | `web/src/lib/share/format.test.ts` (formatSessionText: 6 tests) | Phase 1, Step 4 |
| AC1.4 | -- | Phase 1, Step 5 |
| AC1.5 | -- | Phase 1, Step 6 |
| AC1.6 | -- | Phase 4, Steps 1-3 |
| AC1.7 | `web/src/lib/share/format.test.ts` + structural template guard | Phase 1, Steps 7-8 |
| AC1.8 | `web/src/lib/share/format.test.ts` (buildLetterGrid: 7 tests) | Phase 1, Step 4 |
| AC1.9 | `web/src/lib/share/detect.test.ts` (11 tests) | Phase 4, Step 5 |
| AC1.10 | -- | Phase 2, Step 2 |
| AC2.1 | `web/tests/share-cards.spec.ts` (stats card screenshot) | Phase 3, Step 4 |
| AC2.2 | `web/tests/share-cards.spec.ts` (stat values assertions) | Phase 3, Step 4 |
| AC2.3 | `web/src/lib/share/format.test.ts` (formatStatsText: 5 tests) | Phase 3, Step 3 |
| AC2.4 | -- | Phase 3, Steps 3-5; Phase 4, Step 4 |
| AC2.5 | Structural: `stats/+page.svelte` guards on `data.stats` | Phase 3, Step 6 |
| AC2.6 | `web/src/lib/share/format.test.ts` (null times) | Phase 3, Step 1 |
| AC3.1 | `tui/internal/share/format_test.go` (4 tests) | Phase 5, Steps 2-3 |
| AC3.2 | `tui/internal/share/image_test.go` (dimensions + PNG validity) | Phase 6, Step 3 |
| AC3.3 | `tui/internal/share/clipboard_test.go` (2 tests) | Phase 5, Step 4 |
| AC3.4 | `tui/internal/share/format_test.go` (nil/zero streak: 2 tests) | Phase 5, Step 5 |
| AC3.5 | -- | Phase 7, Steps 1-3 |
| AC3.6 | Structural: `termimg.go` returns false on error | Phase 7, Step 3 |
| AC4.1 | `tui/internal/share/format_test.go` (2 tests) | Phase 6, Steps 1-2 |
| AC4.2 | `tui/internal/share/image_test.go` (dimensions + edge cases) | Phase 6, Step 3 |
| AC4.3 | Structural: `stats.go` claim code check | Phase 6, Step 4 |
| AC4.4 | `tui/internal/share/clipboard_test.go` (same as AC3.3) | Phase 6, Step 5 |
| AC5.1 | `web/tests/share-cards.spec.ts` + `tui/internal/share/image_test.go` | End-to-End: Branding |
| AC5.2 | `web/tests/share-cards.spec.ts` (fonts loaded) | End-to-End: Branding |
| AC5.3 | `web/tests/share-cards.spec.ts` ("UNQUOTE" + "playunquote.com") | End-to-End: Branding |
