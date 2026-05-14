<script lang="ts">
  import { onMount, tick } from "svelte";
  import { fade } from "svelte/transition";
  import { goto } from "$app/navigation";
  import { game } from "$lib/state/game.svelte.js";
  import { identity } from "$lib/state/identity.svelte.js";
  import { assembleSolution, formatTimer } from "$lib/puzzle.js";
  import { checkSolution, recordSession, getStats } from "$lib/api.js";
  import SessionShareCard from "$lib/share/SessionShareCard.svelte";
  import ShareMenu from "$lib/share/ShareMenu.svelte";
  import { formatSessionText, buildLetterGrid } from "$lib/share/format.js";
  import type { SessionShareData } from "$lib/share/format.js";
  import { captureElementAsBlob } from "$lib/share/capture.js";
  import {
    copyImageToClipboard,
    copyTextToClipboard,
    downloadBlob,
    showFeedback,
    nativeShareImage,
  } from "$lib/share/actions.js";
  import { canNativeShare } from "$lib/share/detect.js";
  import type { Cell } from "$lib/puzzle.js";

  // ── Local state ───────────────────────────────────────────────────────
  let kbRef: HTMLInputElement | null = $state(null);
  let timerDisplay = $state("00:00");
  let submitting = $state(false);
  let solvedCardVisible = $state(false);
  let revealComplete = $state(false);
  let statusMessage: {
    text: string;
    kind: "warning" | "error" | "loading";
  } | null = $state(null);
  let sessionShareFeedback = $state<string | null>(null);
  let sessionCardEl: HTMLElement | undefined = $state();
  // Reactive cache for streak API call (reset on page load).
  // Must be reactive so SessionShareCard re-renders when streak is fetched,
  // ensuring the captured image includes the streak badge.
  let cachedStreak: number | null = $state(null);

  // ── Crossfade state ─────────────────────────────────────────────────
  // Drives pure CSS opacity transitions instead of Svelte's in:/out: directives,
  // which can't reliably overlap two {#if} blocks for a simultaneous crossfade.
  // If the puzzle is already loaded (e.g. returning from FAQ), skip the crossfade.
  let puzzleReady = $state(!!game.puzzle);
  let skeletonRemoved = $state(!!game.puzzle);

  $effect(() => {
    if (game.puzzle && !puzzleReady) {
      // Puzzle just loaded. Wait one frame for the DOM to paint,
      // then flip the opacity classes so both layers crossfade.
      requestAnimationFrame(() => {
        puzzleReady = true;
        // After the CSS transition completes, remove skeleton from DOM.
        setTimeout(() => {
          skeletonRemoved = true;
        }, 600);
      });
    }
  });

  // ── Derived: word groups for puzzle grid (groups cells by word, splitting on spaces) ──
  const wordGroups = $derived(
    game.cells
      .reduce<Cell[][]>(
        (groups, cell) => {
          if (cell.kind === "space") {
            groups.push([]);
          } else {
            if (groups.length === 0) {
              groups.push([]);
            }
            groups[groups.length - 1].push(cell);
          }
          return groups;
        },
        [[]],
      )
      .filter((g) => g.length > 0),
  );

  // ── Derived: active cipher letter for "related" cell highlighting ─────
  const activeCipherLetter = $derived(
    game.editables[game.cursorEditIdx]?.cipherLetter ?? null,
  );

  // ── Derived: letter grid for session share card ───────────────────────
  const sessionLetterGrid = $derived(buildLetterGrid(game.cells));

  // ── Timer: runs when playing, stops when solved/checking ─────────────
  $effect(() => {
    if (game.status !== "playing" || game.startTime === null) {
      return;
    }
    const update = () => {
      timerDisplay = formatTimer(Date.now() - game.startTime!);
    };
    update(); // immediate first tick
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  });

  // ── Solved reveal: flip animation → pause → cross-fade grid to solved card
  $effect(() => {
    if (game.status === "solved") {
      if (game.solvedElsewhere) {
        // No grid animation for remote solve — show card immediately
        revealComplete = true;
        solvedCardVisible = true;
        return;
      }
      // Last cell starts flipping at (N-1)*28ms, flip animation is 380ms
      const lastFlipEnd = game.editables.length * 28 + 380;
      // Brief pause after the last cell finishes flipping
      const fadeStart = lastFlipEnd + 300;
      const t1 = setTimeout(() => {
        // Trigger both simultaneously: grid fades out while solved card fades in
        revealComplete = true;
        solvedCardVisible = true;
      }, fadeStart);
      return () => clearTimeout(t1);
    }
  });

  // ── Focus management ──────────────────────────────────────────────────
  function focusKb() {
    kbRef?.focus();
  }

  onMount(() => {
    focusKb();
  });

  // ── Keyboard handler (fires on the hidden input) ──────────────────────
  function handleKey(e: KeyboardEvent) {
    if (game.status !== "playing") {
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      submitSolution();
      return;
    }
    if (e.ctrlKey && e.key === "c") {
      e.preventDefault();
      game.clearAll();
      statusMessage = null;
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      game.setCursor(game.cursorEditIdx - 1);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      game.setCursor(game.cursorEditIdx + 1);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        game.setCursor(game.cursorEditIdx - 1);
      } else {
        game.setCursor(game.cursorEditIdx + 1);
      }
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      handleBackspace();
      return;
    }
    if (/^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      handleLetter(e.key.toUpperCase());
    }
  }

  function handleLetter(letter: string) {
    const current = game.editables[game.cursorEditIdx];
    if (!current) {
      return;
    }
    game.setGuess(current.cipherLetter, letter);
    statusMessage = null;
    // Advance cursor if not at the last cell
    if (game.cursorEditIdx < game.editables.length - 1) {
      game.setCursor(game.cursorEditIdx + 1);
    }
  }

  function handleBackspace() {
    const current = game.editables[game.cursorEditIdx];
    if (!current) {
      return;
    }
    if (current.guess !== null) {
      game.clearGuess(current.cipherLetter);
    } else if (game.cursorEditIdx > 0) {
      // Move back and clear the previous cell
      const prevIdx = game.cursorEditIdx - 1;
      const prev = game.editables[prevIdx];
      game.setCursor(prevIdx);
      if (prev && prev.guess !== null) {
        game.clearGuess(prev.cipherLetter);
      }
    }
  }

  async function submitSolution() {
    if (submitting || game.status !== "playing" || !game.puzzle) {
      return;
    }

    // Validate before sending (AC2.12, AC2.13)
    if (!game.editables.every((c) => c.guess !== null)) {
      statusMessage = { text: "Fill in all letters first.", kind: "warning" };
      return;
    }
    if (game.conflicts.size > 0) {
      statusMessage = {
        text: "Resolve letter conflicts first.",
        kind: "warning",
      };
      return;
    }

    submitting = true;
    statusMessage = { text: "Checking…", kind: "loading" };
    game.status = "checking"; // direct assignment — status is a public $state field

    try {
      const solution = assembleSolution(game.cells);
      const result = await checkSolution(game.puzzle.id, solution);

      if (result.correct) {
        // Capture elapsed time before markSolved clears the timer interval
        const elapsed =
          game.startTime !== null ? Date.now() - game.startTime : null;
        game.markSolved(elapsed);
        // Record the session for registered players (fire-and-forget — never block the UI)
        if (identity.claimCode && game.puzzle && elapsed !== null) {
          recordSession(
            identity.claimCode,
            game.puzzle.id,
            elapsed,
            new Date().toISOString(),
          ).catch(() => {
            // Silently ignore — stats recording failure must not affect the game experience
          });
        }
        statusMessage = null;
      } else {
        game.status = "playing";
        statusMessage = { text: "Not quite — keep trying.", kind: "error" };
      }
    } catch {
      game.status = "playing";
      statusMessage = {
        text: "Network error — please try again.",
        kind: "error",
      };
    } finally {
      submitting = false;
    }
  }

  // Pre-captured blob so clipboard write happens within the user gesture window.
  // Re-captured when the card mounts or when the streak changes (so the badge
  // appears in the image).
  let cachedSessionBlob: Blob | null = $state(null);

  async function captureSessionCard() {
    if (sessionCardEl) {
      cachedSessionBlob = await captureElementAsBlob(sessionCardEl);
    }
  }

  $effect(() => {
    if (sessionCardEl) {
      // Capture eagerly; re-runs when sessionCardEl mounts or cachedStreak changes
      void cachedStreak;
      captureSessionCard();
    }
  });

  async function fetchStreakIfNeeded() {
    if (identity.claimCode && cachedStreak === null) {
      try {
        const stats = await getStats(identity.claimCode);
        cachedStreak = stats.currentStreak;
        // Wait for Svelte to re-render the SessionShareCard with the streak,
        // then re-capture so the image includes the streak badge
        await tick();
        await captureSessionCard();
      } catch {
        // Streak unavailable — share without it
      }
    }
  }

  async function getSessionBlob(): Promise<Blob | null> {
    if (cachedSessionBlob) return cachedSessionBlob;
    await fetchStreakIfNeeded();
    return sessionCardEl ? captureElementAsBlob(sessionCardEl) : null;
  }

  async function handleCopyImage() {
    if (!game.puzzle || game.status !== "solved") return;

    const blob = await getSessionBlob();
    if (blob) {
      const ok = await copyImageToClipboard(blob);
      if (ok) {
        showFeedback((v) => (sessionShareFeedback = v ? "Copied!" : null));
      } else {
        // AC1.10: fallback to download
        downloadBlob(blob, "unquote-session.png");
        showFeedback((v) => (sessionShareFeedback = v ? "Downloaded!" : null));
      }
    }
  }

  async function handleCopyText() {
    if (!game.puzzle || game.status !== "solved") return;

    const data: SessionShareData = {
      puzzleNumber: game.puzzle.date,
      solved: true,
      completionTime: game.completionTime,
      cells: game.cells,
      currentStreak: identity.claimCode ? cachedStreak : null,
    };

    const text = formatSessionText(data);
    await copyTextToClipboard(text);
    showFeedback((v) => (sessionShareFeedback = v ? "Copied!" : null));
  }

  async function handleDownload() {
    if (!game.puzzle || game.status !== "solved") return;

    const blob = await getSessionBlob();
    if (blob) {
      downloadBlob(blob, "unquote-session.png");
      showFeedback((v) => (sessionShareFeedback = v ? "Downloaded!" : null));
    }
  }

  async function handleNativeShare() {
    if (!game.puzzle || game.status !== "solved") return;

    const blob = await getSessionBlob();
    if (blob) {
      const data: SessionShareData = {
        puzzleNumber: game.puzzle.date,
        solved: true,
        completionTime: game.completionTime,
        cells: game.cells,
        currentStreak: identity.claimCode ? cachedStreak : null,
      };
      const text = formatSessionText(data);
      await nativeShareImage(
        blob,
        "unquote-session.png",
        "UNQUOTE Result",
        text,
      );
    }
  }

  function handleCellClick(editIdx: number) {
    game.setCursor(editIdx);
    focusKb(); // re-focus hidden input (AC2.17)
  }

  function diffInfo(score: number): [string, string] {
    if (score <= 25) {
      return ["Easy", "easy"];
    }
    if (score <= 50) {
      return ["Medium", "medium"];
    }
    if (score <= 75) {
      return ["Hard", "hard"];
    }
    return ["Expert", "expert"];
  }

  function fmtDate(str: string): string {
    return new Date(str + "T12:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
</script>

<svelte:head>
  <title>Unquote — Today's Puzzle</title>
</svelte:head>

<!-- Hidden off-screen share card for capture.
     The outer wrapper positions off-screen; bind:this targets the inner
     card element so modern-screenshot's clone doesn't inherit left:-9999px. -->
{#if game.status === "solved" && !game.solvedElsewhere && game.puzzle}
  <div style="position: absolute; left: -9999px; top: -9999px;">
    <div bind:this={sessionCardEl}>
      <SessionShareCard
        puzzleNumber={game.puzzle.date}
        solved={true}
        completionTime={game.completionTime}
        letterGrid={sessionLetterGrid}
        currentStreak={identity.claimCode ? cachedStreak : null}
      />
    </div>
  </div>
{/if}

<!-- Hidden keyboard capture input (AC2.17) -->
<!-- position: fixed keeps it off-screen on all viewport sizes -->
<input
  id="kb"
  type="text"
  autocomplete="off"
  autocorrect="off"
  autocapitalize="none"
  spellcheck={false}
  inputmode="text"
  bind:this={kbRef}
  onkeydown={handleKey}
  aria-hidden="true"
  tabindex="-1"
  style="position:fixed;top:-200px;left:-200px;width:1px;height:1px;opacity:0;"
/>

{#if game.status === "error" || game.errorMessage}
  <!-- Error state (AC4.7) -->
  <main class="screen-center">
    <p class="error-msg">{game.errorMessage ?? "Failed to load puzzle."}</p>
    <a href="/" class="btn-back-link">← Back</a>
  </main>
{:else}
  <div class="game-crossfade">
    {#if !skeletonRemoved}
      <!-- Loading skeleton — fades out via CSS transition when puzzleReady flips -->
      <main class="game-wrap crossfade-layer" class:crossfade-out={puzzleReady}>
        <header class="compact-header">
          <a href="/" class="compact-logo">Unquote</a>
        </header>
        <div class="game-inner">
          <div class="game-meta-bar">
            <span class="skel skel-text" style="width: 5rem"></span>
            <span class="meta-sep">·</span>
            <span class="skel skel-badge"></span>
            <span class="meta-sep">·</span>
            <span class="skel skel-text" style="width: 3rem"></span>
          </div>
          <div style="padding: 0.4rem 0 0">
            <hr class="rule" />
            <div class="game-clues" style="min-height: 2.2rem">
              <span class="skel skel-text" style="width: 3rem"></span>
              <span class="skel skel-chip"></span>
              <span class="skel skel-chip"></span>
            </div>
            <hr class="rule" />
            <div class="progress-track">
              <div class="progress-fill" style="width: 0%"></div>
            </div>
          </div>
          <div class="skel-grid">
            {#each [5, 3, 7, 4, 6, 2, 5, 8, 3] as wordLen}
              <div class="skel-word">
                {#each Array(wordLen) as _}
                  <div class="skel-cell">
                    <div class="skel skel-cell-input"></div>
                    <div class="skel skel-cell-cipher"></div>
                  </div>
                {/each}
              </div>
            {/each}
          </div>
          <div class="skel skel-author"></div>
        </div>
      </main>
    {/if}

    {#if game.puzzle}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="game-wrap crossfade-layer puzzle-layer"
        class:crossfade-in={puzzleReady}
        ontransitionend={(e) => {
          if (e.propertyName === "opacity" && puzzleReady) {
            if (game.status === "playing" && !game.solvedElsewhere) {
              game.startTime = Date.now();
            }
          }
        }}
        onclick={focusKb}
      >
        <!-- Header -->
        <header class="compact-header">
          <a href="/" class="compact-logo">Unquote</a>
          <nav class="header-nav">
            <span class="btn-nav-current">Puzzle</span>
            <a href="/faq" class="btn-nav">FAQ</a>
            {#if identity.claimCode}
              <a href="/stats" class="btn-nav">Stats →</a>
            {/if}
          </nav>
        </header>

        <div class="game-inner">
          <!-- Meta bar: date · difficulty · timer -->
          <div class="game-meta-bar">
            <span id="game-date"
              >{game.puzzle ? fmtDate(game.puzzle.date) : ""}</span
            >
            <span class="meta-sep">·</span>
            {#if game.puzzle}
              {@const [label, cls] = diffInfo(game.puzzle.difficulty)}
              <span class="badge badge-{cls}">{label}</span>
            {/if}
            <span class="meta-sep">·</span>
            <span class="timer">
              {game.status === "solved" && game.completionTime !== null
                ? formatTimer(game.completionTime)
                : timerDisplay}
            </span>
          </div>

          <!-- Clues + progress: hidden after solve -->
          {#if !revealComplete}
            <div style="padding: 0.4rem 0 0" out:fade={{ duration: 400 }}>
              <hr class="rule" />
              <div class="game-clues">
                <span class="clues-label">Clues</span>
                <div class="clue-chips">
                  {#each game.puzzle.hints as hint}
                    <span class="clue-chip"
                      >{hint.cipherLetter} = {hint.plainLetter}</span
                    >
                  {/each}
                </div>
              </div>
              <hr class="rule" />
              <div class="progress-track">
                <div
                  class="progress-fill"
                  style="width: {(game.progress * 100).toFixed(1)}%"
                ></div>
              </div>
            </div>
          {/if}

          {#if !revealComplete}
            <!-- Puzzle grid (AC2.1–2.17) -->
            <div
              class="puzzle-grid"
              class:game-solved={game.status === "solved"}
              role="application"
              aria-label="Cryptogram puzzle"
              out:fade={{ duration: 400 }}
            >
              {#each wordGroups as word}
                <div class="puzzle-word" role="group">
                  {#each word as cell (cell.index)}
                    {#if cell.kind === "punctuation"}
                      <div class="cell punctuation" aria-hidden="true">
                        {cell.char}
                      </div>
                    {:else if cell.kind === "hint"}
                      <div class="cell hint">
                        <div class="cell-input">{cell.plainLetter}</div>
                        <div class="cell-cipher">{cell.cipherLetter}</div>
                      </div>
                    {:else if cell.kind === "letter"}
                      <button
                        class="cell letter"
                        class:active={cell.editIndex === game.cursorEditIdx}
                        class:related={cell.cipherLetter ===
                          activeCipherLetter &&
                          cell.editIndex !== game.cursorEditIdx}
                        class:conflict={game.conflicts.has(cell.cipherLetter)}
                        class:correct={game.status === "solved"}
                        style="--edit-idx: {cell.editIndex}"
                        tabindex="0"
                        onclick={() => handleCellClick(cell.editIndex)}
                        onkeydown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleCellClick(cell.editIndex);
                          }
                        }}
                        aria-label="Cipher {cell.cipherLetter}, guess: {cell.guess ??
                          'empty'}"
                      >
                        <div class="cell-input">{cell.guess ?? "·"}</div>
                        <div class="cell-cipher">{cell.cipherLetter}</div>
                      </button>
                    {/if}
                  {/each}
                </div>
              {/each}
            </div>

            <!-- Attribution -->
            <div class="puzzle-author" class:hidden={game.status === "solved"}>
              — {game.puzzle.author}
            </div>
          {/if}

          {#if !revealComplete}
            <div class="ornament-rule"></div>
          {/if}

          <!-- Solved card (AC2.11, cross-client-sync.AC2.1) -->
          {#if solvedCardVisible}
            <div
              class="solved-card"
              class:solved-elsewhere={game.solvedElsewhere}
              aria-live="polite"
              aria-atomic="true"
              in:fade={{ duration: 500, delay: game.solvedElsewhere ? 0 : 300 }}
            >
              {#if game.solvedElsewhere}
                <div class="solved-eyebrow">Already Solved</div>
                <p class="solved-elsewhere-msg">Solved on another device</p>
              {:else}
                <div class="solved-eyebrow">✦ Decoded ✦</div>
                <blockquote class="solved-quote">
                  {assembleSolution(game.cells)}
                </blockquote>
                <div class="solved-attribution">— {game.puzzle.author}</div>
              {/if}
              {#if game.completionTime !== null}
                <p class="solved-time-line">
                  solved in {formatTimer(game.completionTime)}
                </p>
              {/if}
              {#if !game.solvedElsewhere}
                <ShareMenu
                  onCopyImage={handleCopyImage}
                  onCopyText={handleCopyText}
                  onDownload={handleDownload}
                  onNativeShare={canNativeShare()
                    ? handleNativeShare
                    : undefined}
                  feedback={sessionShareFeedback}
                />
                {#if !identity.claimCode}
                  <p class="solved-register-nudge">
                    Want to track your streak?
                    <button
                      class="solved-register-link"
                      onclick={() => goto("/?action=register")}
                      >Create an account →</button
                    >
                  </p>
                {/if}
              {/if}
            </div>
          {/if}

          <!-- Status messages (AC2.12, AC2.13, AC2.14) -->
          {#if statusMessage && !revealComplete}
            <div class="game-status {statusMessage.kind}" aria-live="polite">
              {statusMessage.text}
            </div>
          {/if}

          <!-- Submit button + keyboard hints: hidden once solved -->
          {#if !revealComplete}
            <div class="game-actions">
              <button
                class="btn-primary"
                onclick={submitSolution}
                disabled={submitting || game.status !== "playing"}
              >
                {game.status === "solved" ? "Decoded ✓" : "Check Answer"}
              </button>
              <div class="keyboard-hints" aria-hidden="true">
                <span><kbd>↵</kbd> submit</span>
                <span><kbd>⌫</kbd> delete</span>
                <span><kbd>←</kbd><kbd>→</kbd> navigate</span>
                <span><kbd>Ctrl+C</kbd> clear</span>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* ── Layout ───────────────────────────────────────────────────── */

  .game-crossfade {
    display: grid;
    min-height: 100dvh;
  }

  .crossfade-layer {
    grid-area: 1 / 1;
    transition: opacity 500ms ease;
  }

  .crossfade-out {
    opacity: 0;
  }

  .puzzle-layer {
    opacity: 0;
  }
  .puzzle-layer.crossfade-in {
    opacity: 1;
  }

  .game-wrap {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    background: var(--color-surface);
  }

  .game-inner {
    width: 100%;
    max-width: 660px;
    padding: 0 1.25rem;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
  }

  /* ── Meta bar ─────────────────────────────────────────────────── */

  .game-meta-bar {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.6rem;
    padding: 0.75rem 0 0;
    font-size: 0.74rem;
    color: var(--color-text-secondary);
  }

  .meta-sep {
    color: var(--color-text-border);
  }

  .badge {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    padding: 0.18em 0.55em;
    border-radius: 2px;
  }
  .badge-easy {
    background: rgba(90, 170, 120, 0.13);
    color: var(--color-green);
  }
  .badge-medium {
    background: rgba(212, 161, 64, 0.12);
    color: var(--color-gold);
  }
  .badge-hard {
    background: rgba(192, 128, 64, 0.14);
    color: var(--color-amber);
  }
  .badge-expert {
    background: rgba(191, 87, 87, 0.15);
    color: var(--color-red);
  }

  .timer {
    font-family: var(--font-mono);
    font-size: 0.77rem;
    letter-spacing: 0.04em;
    font-variant-numeric: tabular-nums;
  }

  /* ── Clues + progress ─────────────────────────────────────────── */

  .rule {
    border: none;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--color-border) 25%,
      var(--color-border) 75%,
      transparent
    );
  }

  .game-clues {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    flex-wrap: wrap;
    padding: 0.85rem 0;
  }

  .clues-label {
    font-size: 0.66rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }

  .clue-chips {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .clue-chip {
    font-family: var(--font-mono);
    font-size: clamp(0.72rem, 1.8vw, 0.82rem);
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 0.22em 0.6em;
    background: var(--color-teal-dim);
    border: 1px solid rgba(79, 163, 184, 0.22);
    border-radius: 2px;
    color: var(--color-teal);
  }

  .progress-track {
    height: 3px;
    background: var(--color-surface-2);
    border-radius: 2px;
    margin-top: 0.2rem;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-teal), var(--color-gold));
    border-radius: 2px;
    transition: width 0.25s ease;
  }

  /* ── Puzzle grid ──────────────────────────────────────────────── */

  .puzzle-grid {
    padding: 1.4rem 0 0.5rem;
    display: flex;
    flex-wrap: wrap;
    column-gap: 28px;
    row-gap: 2.2rem;
    align-items: flex-start;
    cursor: text;
    user-select: none;
  }

  .puzzle-word {
    display: flex;
    gap: 4px;
  }

  .cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 30px;
    flex-shrink: 0;
    font-family: var(--font-mono);
    background: transparent;
    border: none;
    padding: 0;
  }

  .cell-input {
    font-family: var(--font-mono);
    font-size: 1.1rem;
    font-weight: 700;
    width: 30px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1.5px solid var(--color-text-border);
    color: var(--color-text-muted);
    transition:
      background 0.12s,
      border-color 0.14s,
      color 0.12s,
      box-shadow 0.14s;
  }

  .cell-cipher {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--color-teal-mid);
    margin-top: 5px;
    height: 15px;
    display: flex;
    align-items: center;
    letter-spacing: 0.05em;
    transition: color 0.12s;
  }

  .cell.punctuation {
    font-size: 1.1rem;
    color: var(--color-text-secondary);
    justify-content: center;
    height: auto;
  }

  /* Hint cells: teal, not editable (AC2.9) */
  .cell.hint .cell-input {
    color: var(--color-teal);
    border-bottom-color: var(--color-teal-mid);
  }
  .cell.hint .cell-cipher {
    color: var(--color-teal-mid);
  }

  /* Letter cells: cursor: pointer */
  .cell.letter {
    cursor: pointer;
  }

  /* Filled letter cells */
  .cell.letter .cell-input:not(:empty) {
    color: var(--color-text-primary);
  }

  /* Active cell (AC2.6) */
  .cell.letter.active .cell-input {
    background: var(--color-gold-glow);
    border-bottom-color: var(--color-gold);
    box-shadow: 0 3px 14px rgba(212, 161, 64, 0.18);
    color: var(--color-gold-bright);
  }
  .cell.letter.active .cell-cipher {
    color: var(--color-gold-mid);
  }

  /* Related cells: same cipher letter as active cell (AC2.7) */
  .cell.letter.related .cell-input {
    background: var(--color-teal-glow);
    border-bottom-color: var(--color-teal-mid);
  }
  .cell.letter.related .cell-cipher {
    color: var(--color-teal);
  }

  /* Conflict cells (AC2.8) */
  .cell.letter.conflict .cell-input {
    background: var(--color-amber-glow);
    border-bottom-color: var(--color-amber);
    color: var(--color-amber);
  }

  /* Correct cells: staggered flip animation (AC2.11) */
  @keyframes flipReveal {
    0% {
      transform: scaleY(1);
    }
    40% {
      transform: scaleY(0.05);
      opacity: 0.4;
    }
    100% {
      transform: scaleY(1);
      opacity: 1;
    }
  }

  .cell.letter.correct .cell-input {
    color: var(--color-green);
    border-bottom-color: var(--color-green-mid);
    animation: flipReveal 0.38s ease forwards;
    animation-delay: calc(var(--edit-idx) * 28ms);
  }

  /* ── Attribution + ornament ───────────────────────────────────── */

  .puzzle-author {
    font-family: var(--font-display);
    font-style: italic;
    font-size: 1rem;
    color: var(--color-text-secondary);
    text-align: right;
    padding: 1rem 0 1.5rem;
  }

  .puzzle-author.hidden {
    display: none;
  }

  .ornament-rule {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0.5rem 0;
  }
  .ornament-rule::before,
  .ornament-rule::after {
    content: "";
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--color-border));
  }
  .ornament-rule::after {
    background: linear-gradient(90deg, var(--color-border), transparent);
  }

  /* ── Solved card (AC2.11) ─────────────────────────────────────── */

  .solved-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    padding: 3rem 2rem 2.5rem;
    border: 1px solid rgba(90, 170, 120, 0.22);
    background: rgba(90, 170, 120, 0.03);
    border-radius: var(--r-lg);
    text-align: center;
    margin-top: 1.5rem;
    margin-bottom: 1.5rem;
    position: relative;
    overflow: hidden;
  }

  .solved-eyebrow {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--color-green);
  }

  @keyframes quoteReveal {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .solved-quote {
    font-family: var(--font-display);
    font-style: italic;
    font-size: clamp(1.5rem, 4vw, 2.2rem);
    line-height: 1.5;
    color: var(--color-text-primary);
    max-width: 560px;
    margin: 0;
    text-wrap: pretty;
    position: relative;
    animation: quoteReveal 0.6s ease forwards;
    animation-delay: 0.7s;
    opacity: 0;
  }

  /* Large decorative opening mark */
  .solved-quote::before {
    content: "\201C";
    position: absolute;
    top: -2.5rem;
    left: 50%;
    transform: translateX(-50%);
    font-family: var(--font-display);
    font-size: 7rem;
    font-style: normal;
    color: rgba(90, 170, 120, 0.18);
    line-height: 1;
    pointer-events: none;
    user-select: none;
  }

  .solved-attribution {
    font-family: var(--font-display);
    font-style: italic;
    font-size: 1.05rem;
    color: var(--color-text-secondary);
    letter-spacing: 0.02em;
  }

  .solved-time-line {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-green);
    opacity: 0.75;
    font-variant-numeric: tabular-nums;
    margin: 0;
  }

  .solved-elsewhere-msg {
    font-family: var(--font-sans);
    font-size: 0.88rem;
    color: var(--color-text-secondary);
    letter-spacing: 0.02em;
  }

  .solved-register-nudge {
    font-family: var(--font-sans);
    font-size: 0.7rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  .solved-register-link {
    background: none;
    border: none;
    border-bottom: 1px solid var(--color-text-border);
    color: var(--color-text-secondary);
    cursor: pointer;
    font-family: var(--font-sans);
    font-size: 0.7rem;
    padding: 0;
    transition: color 0.15s;
  }

  .solved-register-link:hover {
    color: var(--color-text-primary);
  }

  /* ── Status messages ──────────────────────────────────────────── */

  .game-status {
    min-height: 1.5rem;
    font-size: 0.78rem;
    text-align: center;
    padding: 0.2rem 0;
  }

  .game-status.error {
    color: var(--color-red);
  }

  .game-status.warning {
    color: var(--color-amber);
  }

  .game-status.loading {
    color: var(--color-text-secondary);
  }

  /* ── Actions ──────────────────────────────────────────────────── */

  .game-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.85rem;
    padding-top: 0.25rem;
  }

  .keyboard-hints {
    display: flex;
    gap: 0.9rem;
    flex-wrap: wrap;
    justify-content: center;
    font-size: clamp(0.68rem, 1.6vw, 0.76rem);
    color: var(--color-text-border);
  }

  .keyboard-hints kbd {
    font-family: var(--font-mono);
    font-size: clamp(0.62rem, 1.4vw, 0.68rem);
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 2px;
    padding: 0.1em 0.4em;
    color: var(--color-text-secondary);
  }

  /* ── Error / loading screens ──────────────────────────────────── */

  .screen-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100dvh;
    gap: 1rem;
    font-family: var(--font-sans);
  }

  .error-msg {
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    text-align: center;
    max-width: 280px;
  }

  .loading-msg {
    color: var(--color-text-muted);
    font-size: 0.85rem;
  }

  .btn-back-link {
    color: var(--color-gold);
    text-decoration: none;
    font-size: 0.82rem;
  }

  /* ── Skeleton loader ───────────────────────────────────────── */

  @keyframes shimmer {
    0% {
      opacity: 0.04;
    }
    50% {
      opacity: 0.09;
    }
    100% {
      opacity: 0.04;
    }
  }

  .skel {
    background: var(--color-text-primary);
    opacity: 0.06;
    border-radius: 2px;
    animation: shimmer 1.8s ease-in-out infinite;
  }

  .skel-text {
    display: inline-block;
    height: 0.7rem;
  }

  .skel-badge {
    display: inline-block;
    width: 3.2rem;
    height: 1.1rem;
    border-radius: 2px;
  }

  .skel-chip {
    display: inline-block;
    width: 3.5rem;
    height: 1.4rem;
    border-radius: 2px;
  }

  .skel-grid {
    padding: 1.4rem 0 0.5rem;
    display: flex;
    flex-wrap: wrap;
    column-gap: 28px;
    row-gap: 2.2rem;
  }

  .skel-word {
    display: flex;
    gap: 4px;
  }

  .skel-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 30px;
    gap: 5px;
  }

  .skel-cell-input {
    width: 30px;
    height: 36px;
  }

  .skel-cell-cipher {
    width: 14px;
    height: 10px;
  }

  .skel-author {
    width: 8rem;
    height: 0.85rem;
    margin-left: auto;
    margin-top: 1rem;
    margin-bottom: 1.5rem;
  }
</style>
