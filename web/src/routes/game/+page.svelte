<script lang="ts">
  import { onMount } from "svelte";
  import { game } from "$lib/state/game.svelte.js";
  import { identity } from "$lib/state/identity.svelte.js";
  import { assembleSolution, formatTimer } from "$lib/puzzle.js";
  import { checkSolution, recordSession } from "$lib/api.js";
  import type { Cell } from "$lib/puzzle.js";

  // ── Local state ───────────────────────────────────────────────────────
  let kbRef: HTMLInputElement | null = $state(null);
  let timerDisplay = $state("00:00");
  let submitting = $state(false);
  let solvedCardVisible = $state(false);
  let solveElapsedMs: number | null = $state(null);
  let statusMessage: {
    text: string;
    kind: "warning" | "error" | "loading";
  } | null = $state(null);

  // ── Derived: word groups for puzzle grid (groups cells by word, splitting on spaces) ──
  const wordGroups = $derived(
    game.cells
      .reduce<Cell[][]>(
        (groups, cell) => {
          if (cell.kind === "space") {
            groups.push([]);
          } else {
            if (groups.length === 0) groups.push([]);
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

  // ── Timer: runs when playing, stops when solved/checking ─────────────
  $effect(() => {
    if (game.status !== "playing" || game.startTime === null) return;
    const update = () => {
      timerDisplay = formatTimer(Date.now() - game.startTime!);
    };
    update(); // immediate first tick
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  });

  // ── Solved card: reveal after stagger animation completes ─────────────
  $effect(() => {
    if (game.status === "solved") {
      const delay = game.editables.length * 28 + 450;
      const t = setTimeout(() => {
        solvedCardVisible = true;
      }, delay);
      return () => clearTimeout(t);
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
    if (game.status !== "playing") return;

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
      if (e.shiftKey) game.setCursor(game.cursorEditIdx - 1);
      else game.setCursor(game.cursorEditIdx + 1);
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
    if (!current) return;
    game.setGuess(current.cipherLetter, letter);
    statusMessage = null;
    // Advance cursor if not at the last cell
    if (game.cursorEditIdx < game.editables.length - 1) {
      game.setCursor(game.cursorEditIdx + 1);
    }
  }

  function handleBackspace() {
    const current = game.editables[game.cursorEditIdx];
    if (!current) return;
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
    if (submitting || game.status !== "playing" || !game.puzzle) return;

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
        solveElapsedMs =
          game.startTime !== null ? Date.now() - game.startTime : null;
        game.markSolved();
        // Record the session for registered players (fire-and-forget — never block the UI)
        if (identity.claimCode && game.puzzle && solveElapsedMs !== null) {
          recordSession(
            identity.claimCode,
            game.puzzle.id,
            solveElapsedMs,
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

  function handleCellClick(editIdx: number) {
    game.setCursor(editIdx);
    focusKb(); // re-focus hidden input (AC2.17)
  }

  function diffInfo(score: number): [string, string] {
    if (score <= 25) return ["Easy", "easy"];
    if (score <= 50) return ["Medium", "medium"];
    if (score <= 75) return ["Hard", "hard"];
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
{:else if !game.puzzle}
  <!-- Loading state -->
  <main class="screen-center">
    <p class="loading-msg">Loading puzzle…</p>
  </main>
{:else}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="game-wrap" onclick={focusKb}>
    <!-- Header -->
    <header class="compact-header">
      <span class="compact-logo">Unquote</span>
      {#if identity.claimCode}
        <a href="/stats" class="btn-stats-nav">Stats →</a>
      {/if}
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
          {game.status === "solved" && solveElapsedMs !== null
            ? formatTimer(solveElapsedMs)
            : timerDisplay}
        </span>
      </div>

      <!-- Clues + progress -->
      <div style="padding: 0.4rem 0 0">
        <hr class="rule" />
        <div class="game-clues">
          <span class="clues-label">Clues</span>
          <div class="clue-chips">
            {#each game.puzzle.hints as hint}
              <div class="clue-chip">
                <span class="chip-cipher">{hint.cipherLetter}</span>
                <span class="chip-arrow">→</span>
                <span class="chip-plain">{hint.plainLetter}</span>
              </div>
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

      <!-- Puzzle grid (AC2.1–2.17) -->
      <!-- Words wrap as units (flex-wrap is on .puzzle-grid, not .puzzle-word) -->
      <div
        class="puzzle-grid"
        class:game-solved={game.status === "solved"}
        role="application"
        aria-label="Cryptogram puzzle"
      >
        {#each wordGroups as word}
          <div class="puzzle-word" role="group">
            {#each word as cell (cell.index)}
              {#if cell.kind === "punct"}
                <div class="cell punct" aria-hidden="true">{cell.char}</div>
              {:else if cell.kind === "hint"}
                <!-- Hint cells: teal, not editable (AC2.9) -->
                <div class="cell hint">
                  <div class="cell-cipher">{cell.cipherLetter}</div>
                  <div class="cell-input">{cell.plainLetter}</div>
                </div>
              {:else if cell.kind === "letter"}
                <!-- Letter cell: editable (AC2.1–2.8, AC2.15) -->
                <button
                  class="cell letter"
                  class:active={cell.editIndex === game.cursorEditIdx}
                  class:related={cell.cipherLetter === activeCipherLetter &&
                    cell.editIndex !== game.cursorEditIdx}
                  class:conflict={game.conflicts.has(cell.cipherLetter)}
                  class:correct={game.status === "solved"}
                  style="--edit-idx: {cell.editIndex}"
                  tabindex="0"
                  onclick={() => handleCellClick(cell.editIndex)}
                  onkeydown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleCellClick(cell.editIndex); // AC2.15
                    }
                  }}
                  aria-label="Cipher {cell.cipherLetter}, guess: {cell.guess ??
                    'empty'}"
                >
                  <div class="cell-cipher">{cell.cipherLetter}</div>
                  <div class="cell-input">{cell.guess ?? "·"}</div>
                </button>
              {/if}
            {/each}
          </div>
        {/each}
      </div>

      <!-- Attribution -->
      <div class="puzzle-author">— {game.puzzle.author}</div>

      <div class="ornament-rule"><span>✦ · ✦ · ✦</span></div>

      <!-- Solved card (AC2.11) -->
      {#if solvedCardVisible}
        <div class="solved-card" aria-live="polite" aria-atomic="true">
          <div class="solved-eyebrow">✦ Decoded ✦</div>
          <blockquote class="solved-quote">
            "{assembleSolution(game.cells)}"
          </blockquote>
          <div class="solved-attribution">— {game.puzzle.author}</div>
          <div class="solved-stats">
            <div class="stat-group">
              <span class="stat-value">
                {solveElapsedMs !== null ? formatTimer(solveElapsedMs) : "—"}
              </span>
              <span class="stat-label">Time</span>
            </div>
          </div>
        </div>
      {/if}

      <!-- Status messages (AC2.12, AC2.13, AC2.14) -->
      {#if statusMessage}
        <div class="game-status {statusMessage.kind}" aria-live="polite">
          {statusMessage.text}
        </div>
      {/if}

      <!-- Submit button + keyboard hints -->
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
    </div>
  </div>
{/if}

<style>
  /* ── Layout ───────────────────────────────────────────────────── */

  .game-wrap {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    background: var(--color-surface);
  }

  .compact-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border);
  }

  /* NOTE: The game screen uses --font-display (Cormorant Garamond, italic) for the
     compact wordmark. Phase 4 (landing/onboarding) uses --font-mono for a terminal
     aesthetic. The difference is intentional — the game screen logo is more refined
     and literary. If the prototype shows a single consistent style, align both. */
  .compact-logo {
    font-family: var(--font-display);
    font-size: 1.2rem;
    color: var(--color-gold);
    font-style: italic;
  }

  .btn-stats-nav {
    font-family: var(--font-sans);
    font-size: 0.78rem;
    color: var(--color-text-secondary);
    text-decoration: none;
    letter-spacing: 0.04em;
  }

  .game-inner {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 540px;
    margin: 0 auto;
    padding: 1rem 1rem 2rem;
    width: 100%;
  }

  /* ── Meta bar ─────────────────────────────────────────────────── */

  .game-meta-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: var(--font-sans);
    font-size: 0.78rem;
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
    font-size: 0.88rem;
    color: var(--color-text-primary);
    letter-spacing: 0.05em;
  }

  /* ── Clues + progress ─────────────────────────────────────────── */

  .rule {
    border: none;
    border-top: 1px solid var(--color-border);
    margin: 0;
  }

  .game-clues {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.35rem 0;
  }

  .clues-label {
    font-family: var(--font-sans);
    font-size: 0.72rem;
    color: var(--color-text-muted);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .clue-chips {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .clue-chip {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
    background: var(--color-teal-dim);
    border: 1px solid rgba(125, 212, 232, 0.2);
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }

  .chip-cipher {
    color: var(--color-teal);
  }
  .chip-arrow {
    color: var(--color-text-muted);
  }
  .chip-plain {
    color: var(--color-teal);
  }

  .progress-track {
    height: 3px;
    background: var(--color-surface-2);
    border-radius: 2px;
    overflow: hidden;
    margin-top: 0.35rem;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-gold);
    border-radius: 2px;
    transition: width 0.15s ease;
  }

  /* ── Puzzle grid ──────────────────────────────────────────────── */

  /* flex-wrap on .puzzle-grid (not .puzzle-word) so words wrap as units */
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
    justify-content: flex-end;
    min-width: 2.2rem;
    height: 2.8rem;
    padding: 0.1rem;
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    background: transparent;
    border: none;
  }

  .cell-cipher {
    font-size: 0.65rem;
    letter-spacing: 0.06em;
    color: var(--color-teal);
    height: 1rem;
    line-height: 1;
  }

  .cell-input {
    width: 100%;
    min-width: 1.8rem;
    height: 1.8rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    font-weight: 700;
    text-transform: uppercase;
    border-bottom: 2px solid var(--color-border-vis);
    color: var(--color-text-primary);
    letter-spacing: 0.04em;
  }

  .cell.punct {
    min-width: 0.8rem;
    height: 2.8rem;
    justify-content: flex-end;
    font-size: 1.1rem;
    color: var(--color-text-secondary);
    padding-bottom: 0.25rem;
  }

  /* Hint cells: teal label, not editable (AC2.9) */
  .cell.hint .cell-cipher {
    color: var(--color-teal);
  }
  .cell.hint .cell-input {
    color: var(--color-teal);
    border-bottom-color: rgba(125, 212, 232, 0.3);
  }

  /* Letter cells: cursor: pointer, gold focus ring */
  .cell.letter {
    cursor: pointer;
    padding: 0.1rem 0.2rem;
  }

  /* Active cell (AC2.6: click or navigate to cell) */
  .cell.letter.active .cell-input {
    border-bottom-color: var(--color-gold);
    background: var(--color-gold-glow);
    border-radius: 2px 2px 0 0;
  }

  /* Related cells: same cipher letter as active cell (AC2.7) */
  .cell.letter.related .cell-input {
    background: rgba(212, 161, 64, 0.07);
    border-bottom-color: rgba(212, 161, 64, 0.4);
  }

  /* Conflict cells: two cipher letters → same plain letter (AC2.8) */
  .cell.letter.conflict .cell-input {
    background: var(--color-amber-glow);
    border-bottom-color: var(--color-amber);
    color: var(--color-amber);
  }

  /* Correct cells: staggered green flip animation (AC2.11) */
  @keyframes cell-flip {
    0% {
      transform: scaleY(1);
    }
    50% {
      transform: scaleY(0.05);
    }
    51% {
      transform: scaleY(0.05);
      background: var(--color-green);
    }
    100% {
      transform: scaleY(1);
      background: var(--color-green);
    }
  }

  .cell.letter.correct .cell-input {
    animation: cell-flip 0.32s ease forwards;
    animation-delay: calc(var(--edit-idx) * 28ms);
    color: var(--color-surface);
    background: var(--color-green);
    border-bottom-color: transparent;
  }

  /* ── Attribution + ornament ───────────────────────────────────── */

  .puzzle-author {
    font-family: var(--font-display);
    font-size: 0.95rem;
    font-style: italic;
    color: var(--color-text-secondary);
    text-align: right;
    padding: 0.25rem 0;
  }

  .ornament-rule {
    text-align: center;
    font-size: 0.65rem;
    color: var(--color-gold-dim);
    letter-spacing: 0.2em;
    margin: 0.25rem 0;
  }

  /* ── Solved card (AC2.11) ─────────────────────────────────────── */

  .solved-card {
    background: var(--color-surface-elevated);
    border: 1px solid var(--color-green-border);
    border-radius: 8px;
    padding: 1.25rem 1.5rem;
    text-align: center;
    animation: fade-up 0.5s ease both;
  }

  @keyframes fade-up {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .solved-eyebrow {
    font-family: var(--font-sans);
    font-size: 0.72rem;
    letter-spacing: 0.15em;
    color: var(--color-green);
    text-transform: uppercase;
    margin-bottom: 0.75rem;
  }

  .solved-quote {
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-style: italic;
    color: var(--color-text-primary);
    line-height: 1.5;
    margin: 0 0 0.5rem;
  }

  .solved-attribution {
    font-family: var(--font-display);
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    margin-bottom: 1rem;
  }

  .solved-stats {
    display: flex;
    justify-content: center;
    gap: 2rem;
  }

  .stat-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
  }

  .stat-value {
    font-family: var(--font-mono);
    font-size: 1.4rem;
    color: var(--color-green);
    font-weight: 700;
  }

  .stat-label {
    font-family: var(--font-sans);
    font-size: 0.72rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  /* ── Status messages ──────────────────────────────────────────── */

  .game-status {
    font-family: var(--font-sans);
    font-size: 0.82rem;
    padding: 0.4rem 0.75rem;
    border-radius: 5px;
    text-align: center;
  }

  .game-status.warning {
    background: rgba(192, 128, 64, 0.12);
    color: var(--color-amber);
    border: 1px solid rgba(192, 128, 64, 0.25);
  }

  .game-status.error {
    background: rgba(191, 87, 87, 0.12);
    color: var(--color-red);
    border: 1px solid rgba(191, 87, 87, 0.25);
  }

  .game-status.loading {
    background: transparent;
    color: var(--color-text-muted);
  }

  /* ── Actions ──────────────────────────────────────────────────── */

  .game-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .btn-primary {
    width: 100%;
    max-width: 280px;
    padding: 0.7rem 1.5rem;
    background: var(--color-gold);
    color: var(--color-surface);
    font-family: var(--font-sans);
    font-size: 0.88rem;
    font-weight: 600;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    letter-spacing: 0.05em;
    transition: opacity 0.15s;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .keyboard-hints {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    justify-content: center;
    font-family: var(--font-sans);
    font-size: 0.72rem;
    color: var(--color-text-muted);
  }

  .keyboard-hints kbd {
    display: inline-block;
    padding: 0.05rem 0.25rem;
    border: 1px solid var(--color-border-vis);
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.68rem;
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
</style>
