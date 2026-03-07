# Shareable Stats Design

## Summary

Shareable stats adds the ability for Unquote players to share their puzzle results and overall statistics, mirroring the sharing patterns popularized by Wordle. Two payloads are supported: a session result card (single puzzle outcome with a letter-decode emoji grid, time, and streak) and an overall stats card (aggregate statistics with a sparkline). Each payload has a plain-text format suitable for pasting into social media and a branded PNG image format that matches the application's visual identity. No server-side changes are required: all data is either already held locally (game state in localStorage or TUI memory) or available from the existing player stats endpoint.

The web frontend generates PNG images client-side by rendering hidden Svelte components off-screen and capturing them with the `modern-screenshot` library, then distributing the result through whichever browser APIs are available: the Clipboard API for image blobs, a download link, or the native Web Share API on mobile. The TUI generates PNG cards using the `gg` Go graphics library with embedded font assets, and optionally renders them inline in image-capable terminals via `go-termimg`. Both surfaces share the same Wordle-style text format and degrade gracefully when clipboard access or image capabilities are unavailable.

## Definition of Done

Players can share their Unquote results and stats from both the web frontend and TUI, using branded images and/or formatted text, without any server-side changes.

**Deliverables:**

1. **Web -- Session share**: After solving a puzzle, players can share today's result (date, solved/failed, time) as image or text via clipboard, download, or native share sheet
2. **Web -- Stats share**: On the stats page, players can share their overall stats card (games played, solved, win rate, streaks, times) as image or text via clipboard, download, or native share sheet
3. **TUI -- Session share**: After solving, players can copy today's result to clipboard as text (and optionally as image in kitty-like terminals)
4. **TUI -- Stats share**: `unquote stats --share` copies overall stats to clipboard as text (and optionally as image in kitty-like terminals)
5. **Branding**: Shared images use a branded template derived from the existing visual identity (dark navy, warm gold, teal, Cormorant Garamond + Space Mono)

**Out of scope:** Server-side changes, share links/URLs, social media API integrations, sharing for anonymous (non-registered) players.

## Acceptance Criteria

### shareable-stats.AC1: Web Session Share
- **shareable-stats.AC1.1 Success:** Post-solve share generates a 1200x628 PNG image with correct branding (navy background, gold text, UNQUOTE wordmark)
- **shareable-stats.AC1.2 Success:** Session card displays puzzle number, solve status, completion time, letter grid, and streak
- **shareable-stats.AC1.3 Success:** Post-solve share copies Wordle-style text to clipboard (puzzle number, status emoji, time, letter grid, streak, URL)
- **shareable-stats.AC1.4 Success:** "Copy Image" writes PNG blob to clipboard via ClipboardItem API
- **shareable-stats.AC1.5 Success:** "Download PNG" triggers browser download of the share card image
- **shareable-stats.AC1.6 Success:** "Share..." invokes Web Share API with image file on supported browsers
- **shareable-stats.AC1.7 Failure:** Share button hidden on post-solve screen for unsolved puzzles where game state is no longer available
- **shareable-stats.AC1.8 Edge:** Letter grid correctly represents word boundaries and line wraps for quotes of varying lengths
- **shareable-stats.AC1.9 Edge:** "Share..." option hidden when `navigator.canShare()` returns false
- **shareable-stats.AC1.10 Edge:** If clipboard image write fails, falls back to PNG download with "Downloaded instead" feedback

### shareable-stats.AC2: Web Stats Share
- **shareable-stats.AC2.1 Success:** Stats page share generates a 1200x628 PNG image with player statistics and mini sparkline
- **shareable-stats.AC2.2 Success:** Stats card displays games played, win rate, current streak, best streak, best time, average time
- **shareable-stats.AC2.3 Success:** Stats share copies formatted text to clipboard (games, win rate, streaks, times, URL)
- **shareable-stats.AC2.4 Success:** All three distribution methods (clipboard, download, Web Share) work for stats card
- **shareable-stats.AC2.5 Failure:** Stats share button hidden for anonymous players (no claim code)
- **shareable-stats.AC2.6 Edge:** Stats card handles null best/average times gracefully (no games solved yet)

### shareable-stats.AC3: TUI Session Share
- **shareable-stats.AC3.1 Success:** Post-solve keybinding copies session result text to system clipboard
- **shareable-stats.AC3.2 Success:** With `--image` equivalent, generates branded PNG and copies to image clipboard
- **shareable-stats.AC3.3 Failure:** When clipboard is unavailable (SSH, headless), prints text to stdout with explanatory message
- **shareable-stats.AC3.4 Edge:** Session share without claim code omits streak line
- **shareable-stats.AC3.5 Edge:** Image-capable terminals (kitty, sixel, iTerm2) display inline image preview
- **shareable-stats.AC3.6 Edge:** Terminals without image protocol skip inline display silently

### shareable-stats.AC4: TUI Stats Share
- **shareable-stats.AC4.1 Success:** `unquote stats --share` copies formatted stats text to clipboard
- **shareable-stats.AC4.2 Success:** `unquote stats --share --image` generates branded PNG and copies to image clipboard
- **shareable-stats.AC4.3 Failure:** `unquote stats --share` without claim code returns error (consistent with existing `stats` command behavior)
- **shareable-stats.AC4.4 Failure:** Clipboard unavailable prints stats to stdout

### shareable-stats.AC5: Branding
- **shareable-stats.AC5.1 Success:** Share card uses dark navy background (#0c0c18) matching application surface color
- **shareable-stats.AC5.2 Success:** Share card uses Space Mono for numbers/branding and Cormorant Garamond for display headings
- **shareable-stats.AC5.3 Success:** Share card includes UNQUOTE wordmark and `playunquote.com` footer

## Glossary

- **Cryptoquip**: A word puzzle where each letter in a quote is substituted with a different letter; players decode the quote by identifying the substitution cipher.
- **Claim code**: An opaque identifier issued to a registered Unquote player, used to persist and retrieve stats across sessions without a traditional account.
- **Session result**: The outcome of a single puzzle attempt: puzzle number, solved/unsolved status, completion time, letter grid, and current streak.
- **Letter decode grid**: An emoji representation of a puzzle result where each letter position in the quote is shown as a colored square (gold = decoded, white = not decoded), with word boundaries and line wraps preserved.
- **Sparkline**: A small, stripped-down chart showing the shape of recent solve times without axis labels or annotations; used in the stats share card.
- **Web Share API**: A browser API (`navigator.share()`) that invokes the device's native share sheet, enabling sharing to apps like Messages, Mail, or social platforms.
- **ClipboardItem API**: A browser API (`navigator.clipboard.write()` with `ClipboardItem`) that writes non-text content (such as PNG image blobs) directly to the system clipboard.
- **`modern-screenshot`**: A JavaScript library that renders a DOM element to a PNG image client-side by traversing the element's styles and serializing them to a canvas.
- **`gg` (fogleman/gg)**: A Go library for 2D graphics rendering, used to draw the TUI share card layout onto an in-memory image.
- **`golang.design/x/clipboard`**: A Go library that extends clipboard support to image (PNG blob) data, used for TUI image clipboard writes.
- **`go-termimg`**: A Go library that renders images inline in terminal emulators, auto-detecting support for the kitty graphics protocol, sixel, and iTerm2 inline image protocol.
- **Kitty graphics protocol**: A terminal image display protocol supported by the kitty terminal emulator, allowing pixel-accurate images to be rendered inline in the terminal.
- **Sixel**: An older terminal graphics format supported by many terminal emulators, encoding images as colored bands of pixels.
- **Go `embed`**: A Go standard library feature that bundles static files (such as font TTFs) directly into the compiled binary at build time.
- **Progressive enhancement**: A design strategy where a baseline experience (text sharing) works everywhere, and richer capabilities (image generation, inline terminal display) are added when the environment supports them.
- **DOM snapshot**: The technique of capturing a rendered HTML/CSS element as an image by serializing its computed styles and layout, as used by `modern-screenshot`.
- **CSS custom properties**: Variables defined in CSS (e.g., `--color-gold`) that are reused across components; the share card inherits these from `app.css` to stay visually consistent with the app.
- **SIL Open Font License (OFL)**: An open-source font license that permits embedding fonts in applications and binaries.

## Architecture

Two share payloads exist: **session result** (single puzzle outcome) and **overall stats** (aggregate player statistics). Each payload has a text format and an image format. The web frontend generates both; the TUI always generates text and optionally generates images as a progressive enhancement.

### Share Payloads

**Session result** (post-solve screen, TUI post-solve):
- Puzzle number, solve status (solved/unsolved), completion time
- Letter decode grid: one emoji per letter in the quote (gold = decoded, white = not), spaces preserved, line-wrapped at ~30 characters
- Current streak (if registered player)
- `playunquote.com` footer URL

**Overall stats** (stats page, `unquote stats --share`):
- Games played, games solved, win rate
- Current streak and best streak
- Best solve time and average time
- Mini sparkline chart of recent solve times (image format only)

### Text Format

Wordle-style minimal, designed for social media paste:

Session result:
```
UNQUOTE #42 ✅ 2:08

🟨⬜🟨 🟨⬜🟨⬜🟨
🟨⬜🟨🟨🟨 🟨⬜🟨

🔥 12-day streak
playunquote.com
```

Overall stats:
```
UNQUOTE Stats

🎮 42 played · 38 solved · 90%
🔥 12-day streak (best: 18)
⏱️ Best 1:42 · Avg 2:31

playunquote.com
```

### Image Format

Both card types use 1200x628 dimensions (social card ratio). Visual identity matches the application: dark navy background (#0c0c18) with grain texture, gold (#d4a140) stat values, teal (#7dd4e8) chart elements, Space Mono for numbers and branding, Cormorant Garamond for display headings.

**Session result card:**
- Top: UNQUOTE wordmark + puzzle date
- Center: "SOLVED"/"UNSOLVED" status + completion time (large, gold)
- Bottom-left: Letter grid as small colored squares
- Bottom-right: Streak badge
- Footer: `playunquote.com`

**Stats card:**
- Top: UNQUOTE wordmark + "PLAYER STATS"
- Center: 2x2 grid of primary stats (games played, win rate, current streak, best streak) with large gold numbers and muted labels
- Bottom: Best time and average time
- Mini sparkline chart (teal, simplified -- shape only, no axis labels)
- Footer: `playunquote.com`

### Web Image Generation

DOM snapshot approach using `modern-screenshot`. A hidden `ShareCard` Svelte component renders off-screen at fixed dimensions, reusing the same CSS custom properties and fonts from `web/src/app.css`. After `document.fonts.ready` resolves, `modern-screenshot` captures the DOM element as a PNG blob.

This blob feeds all three distribution methods:
1. **Clipboard**: `navigator.clipboard.write()` with `ClipboardItem({ 'image/png': blob })`
2. **Download**: Object URL from blob triggers `<a download>` click
3. **Web Share API**: `navigator.share({ files: [File] })` for native share sheet on mobile

Feature detection gates each method. Text clipboard (`navigator.clipboard.writeText()`) serves as the universal fallback.

### Web UI

Share button with dropdown menu offering: Copy Image, Copy Text, Download PNG, and Share (native, mobile only -- hidden when `navigator.canShare()` returns false).

2.5s feedback toast ("Copied!" / "Downloaded!") matches the existing `copyCode()` pattern in `web/src/routes/+page.svelte`.

**Trigger locations:**
- Stats page (`web/src/routes/stats/+page.svelte`): share button near the "YOUR STATISTICS" header
- Post-solve screen: share button alongside existing controls

### TUI Text Sharing

Plain text formatters (`FormatSessionText()` and `FormatStatsText()`) produce the Wordle-style text templates. Letter grid is derived from the game state's cipher mappings held in `internal/app/model.go`.

Text is copied to system clipboard via `atotto/clipboard` (already an indirect dependency in `tui/go.mod`).

### TUI Image Sharing (Progressive Enhancement)

PNG card generation using `gg` (fogleman/gg) with custom fonts rendered via `golang.org/x/image/font/opentype`. Font files (Space Mono, Cormorant Garamond TTFs, ~200KB total) are embedded as Go `embed` assets. Card layout mirrors the web share card design.

Image distribution:
- Clipboard: `golang.design/x/clipboard` (supports PNG blobs cross-platform)
- Inline terminal display: `go-termimg` (auto-detects kitty graphics protocol, sixel, and iTerm2)

**TUI share triggers:**

| Trigger | Payload | Behavior |
|---------|---------|----------|
| Post-solve keybinding | Session result | Copy text; show inline image if terminal supports it |
| `unquote stats --share` | Overall stats | Copy text to clipboard |
| `unquote stats --share --image` | Overall stats | Copy text + generate PNG to image clipboard + inline display |

### Data Sources

No new API endpoints. All data comes from existing sources:
- **Session result**: Game state already held locally (localStorage on web, in-memory on TUI) + `PlayerStatsResponse.currentStreak` for streak display
- **Overall stats**: `GET /player/{claimCode}/stats` returns `PlayerStatsResponse` (existing endpoint, unchanged)

### Error Handling

**Web:**
- `document.fonts.ready` timeout (3s) -- proceed with system font substitution
- `modern-screenshot` failure -- fall back to text clipboard with "Copied text instead" feedback
- Clipboard image write denied -- fall back to PNG download
- Web Share API unavailable -- hide "Share..." option via feature detection
- Anonymous player -- session share available (local data), stats share button hidden

**TUI:**
- Clipboard unavailable (SSH, headless) -- print text to stdout with message
- Image generation failure -- fall back to text-only clipboard
- Terminal lacks image protocol -- skip inline display silently; image still written to clipboard if `--image` was used
- No claim code -- session text only (no streak line); `stats --share` already validates claim code

## Existing Patterns

**Web clipboard pattern:** `web/src/routes/+page.svelte` lines 110-116 implement `copyCode()` using `navigator.clipboard.writeText()` with silent error handling and 2.5s visual feedback timeout. Share distribution reuses this pattern, extending it to support image blobs via `ClipboardItem`.

**Web CSS custom properties:** `web/src/app.css` defines the full color and typography system as CSS custom properties (`--color-gold`, `--color-surface`, `--font-mono`, etc.). Share card components reuse these properties directly, ensuring visual consistency without duplication.

**Web stats data flow:** `web/src/routes/stats/+page.ts` loads stats via `getStats(claimCode)` from `web/src/lib/api.ts`. Share functionality uses the same data already loaded by the page -- no additional API calls.

**TUI stats rendering:** `tui/internal/app/view.go` (lines 294-377) and `tui/cmd/stats.go` (lines 73-149) define the stats display format. Text share formatters parallel this structure but output plain text (no ANSI codes) suitable for clipboard paste.

**TUI styling constants:** `tui/internal/ui/styles.go` defines `ColorPrimary` (purple), `ColorMuted` (gray), and pre-built Lip Gloss styles. Image generation uses the web's color palette (navy/gold/teal) rather than the TUI's terminal palette, since images are viewed outside the terminal.

## Implementation Phases

<!-- START_PHASE_1 -->
### Phase 1: Text Formatters and Clipboard (Web)

**Goal:** Plain text sharing from both share triggers on web

**Components:**
- Text formatter module in `web/src/lib/share/` -- `formatSessionText()` and `formatStatsText()` pure functions, plus `buildLetterGrid()` for emoji grid generation
- Share action handler in `web/src/lib/share/` -- clipboard write with fallback and feedback state
- Share button UI on stats page (`web/src/routes/stats/+page.svelte`) and post-solve screen
- Unit tests for text formatters and letter grid generation

**Dependencies:** None

**Covers:** shareable-stats.AC1.3, shareable-stats.AC2.3, shareable-stats.AC1.7, shareable-stats.AC2.5, shareable-stats.AC1.8, shareable-stats.AC2.6

**Done when:** Players can copy formatted text to clipboard from both the stats page and post-solve screen, with 2.5s feedback toast
<!-- END_PHASE_1 -->

<!-- START_PHASE_2 -->
### Phase 2: Image Generation (Web)

**Goal:** Branded PNG share cards generated client-side

**Components:**
- `SessionShareCard` and `StatsShareCard` Svelte components in `web/src/lib/share/` -- hidden off-screen elements with fixed 1200x628 dimensions, using existing CSS custom properties
- Image generation module in `web/src/lib/share/` -- `modern-screenshot` integration with `document.fonts.ready` gate
- `modern-screenshot` dependency added to `web/package.json`

**Dependencies:** Phase 1 (share action handler and UI triggers exist)

**Covers:** shareable-stats.AC1.1, shareable-stats.AC1.2, shareable-stats.AC2.1, shareable-stats.AC2.2, shareable-stats.AC5.1, shareable-stats.AC5.2, shareable-stats.AC5.3

**Done when:** Share actions produce branded PNG images; clipboard image copy and PNG download work; share cards use correct branding
<!-- END_PHASE_2 -->

<!-- START_PHASE_3 -->
### Phase 3: Web Share API and Distribution Polish

**Goal:** Native share sheet on mobile and complete distribution fallback chain

**Components:**
- Web Share API integration in share action handler -- `navigator.share()` with file support, gated by `navigator.canShare()`
- Share button dropdown menu with all options (Copy Image, Copy Text, Download PNG, Share...)
- Feature detection logic to show/hide options based on browser capabilities
- Fallback chain: image clipboard -> download -> text clipboard
- Integration tests for distribution fallback chain

**Dependencies:** Phase 2 (image blob generation exists)

**Covers:** shareable-stats.AC1.4, shareable-stats.AC1.5, shareable-stats.AC1.6, shareable-stats.AC2.4, shareable-stats.AC1.9, shareable-stats.AC1.10

**Done when:** Native share sheet works on mobile, fallback chain degrades gracefully, options hidden when APIs unavailable
<!-- END_PHASE_3 -->

<!-- START_PHASE_4 -->
### Phase 4: Playwright E2E and Visual Checks (Web)

**Goal:** E2E tests that capture share card screenshots as CI artifacts

**Components:**
- Playwright test suite in `web/tests/` -- navigates to stats page and post-solve screen, triggers share, captures share card element screenshots
- CI workflow step to upload screenshots as GitHub Actions artifacts
- Optional PR comment with artifact links via `actions/github-script`

**Dependencies:** Phase 2 (share card components exist)

**Covers:** shareable-stats.AC5.1, shareable-stats.AC5.2 (visual verification)

**Done when:** CI produces downloadable share card screenshots on every PR touching the feature; Playwright tests assert structural correctness (card renders, contains expected text)
<!-- END_PHASE_4 -->

<!-- START_PHASE_5 -->
### Phase 5: Text Formatters and Clipboard (TUI)

**Goal:** Plain text sharing from TUI post-solve and CLI

**Components:**
- Text formatter package in `tui/internal/share/` -- `FormatSessionText()`, `FormatStatsText()`, `BuildLetterGrid()` functions
- Post-solve keybinding in `tui/internal/app/update.go` -- triggers text clipboard copy
- `--share` flag on `stats` command in `tui/cmd/stats.go` -- copies text to clipboard or prints to stdout
- Promote `atotto/clipboard` from indirect to direct dependency
- Table-driven unit tests for formatters and grid generation

**Dependencies:** None (TUI phases are independent of web phases)

**Covers:** shareable-stats.AC3.1, shareable-stats.AC4.1, shareable-stats.AC3.3, shareable-stats.AC4.3, shareable-stats.AC3.4, shareable-stats.AC4.4

**Done when:** `unquote stats --share` copies text to clipboard; post-solve share keybinding copies session text; clipboard-unavailable fallback prints to stdout
<!-- END_PHASE_5 -->

<!-- START_PHASE_6 -->
### Phase 6: Image Generation (TUI)

**Goal:** Branded PNG card generation and image clipboard/terminal display

**Components:**
- Image generation package in `tui/internal/share/` -- `GenerateSessionCard()` and `GenerateStatsCard()` using `gg` library
- Embedded font assets (Space Mono, Cormorant Garamond TTFs) via Go `embed`
- Font rendering via `golang.org/x/image/font/opentype`
- Image clipboard via `golang.design/x/clipboard`
- Inline terminal display via `go-termimg`
- `--image` flag on `stats --share` command
- PNG structural validity tests (decode + verify dimensions)

**Dependencies:** Phase 5 (share triggers and text formatters exist)

**Covers:** shareable-stats.AC3.2, shareable-stats.AC4.2, shareable-stats.AC3.5, shareable-stats.AC3.6, shareable-stats.AC5.1, shareable-stats.AC5.2, shareable-stats.AC5.3

**Done when:** `unquote stats --share --image` generates branded PNG and copies to image clipboard; image-capable terminals display inline preview; terminals without image support degrade silently
<!-- END_PHASE_6 -->

## Additional Considerations

**Anonymous session sharing:** Anonymous players (no claim code) can share session results from the post-solve screen since that data is local. The streak line is omitted. Stats sharing requires registration and is hidden for anonymous users, consistent with the current stats page empty state.

**Letter grid for unsolved puzzles:** When a player views the post-solve screen after an unsuccessful attempt, the letter grid shows a mix of gold (correctly decoded positions) and white (incorrect/empty positions). This requires the game state's cipher mapping to still be available at share time.

**Font licensing:** Space Mono (OFL) and Cormorant Garamond (OFL) are both licensed under the SIL Open Font License, which permits embedding in applications. TTF files can be included in the TUI binary via Go embed.
