<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { registerPlayer } from "$lib/api.js";
  import { identity } from "$lib/state/identity.svelte.js";
  import { validateClaimCode } from "$lib/claim-code.js";

  // ── Step state machine ──────────────────────────────────────
  type Step =
    | "landing"
    | "choose"
    | "registering"
    | "registered"
    | "enter-code";
  let step = $state<Step>("landing");

  // Registration
  let claimCode = $state("");
  let registrationError = $state("");

  // Enter-code step
  let codeInput = $state("");
  let codeError = $state("");

  // Copy feedback
  let copyFeedback = $state(false);

  // ── Demo cells animation ────────────────────────────────────
  const DEMO_CELLS = [
    { cipher: "R", plain: "D" },
    { cipher: "T", plain: "E" },
    { cipher: "E", plain: "C" },
    { cipher: "E", plain: "O" },
    { cipher: "R", plain: "D" },
    { cipher: "T", plain: "E" },
  ] as const;

  const DEMO_PLAIN = DEMO_CELLS.map((c) => c.plain);

  type DemoCell = { display: string; resolved: boolean };
  let demoCells = $state<DemoCell[]>(
    DEMO_PLAIN.map(() => ({ display: "·", resolved: false })),
  );
  let captionVisible = $state(false);

  let demoTimeouts: ReturnType<typeof setTimeout>[] = [];

  function runDemoAnimation() {
    // Reset: clear cells to dot, hide caption
    demoCells = DEMO_PLAIN.map(() => ({ display: "·", resolved: false }));
    captionVisible = false;

    // Reveal letters: 1200ms initial delay, 380ms per letter
    DEMO_PLAIN.forEach((letter, i) => {
      const t = setTimeout(
        () => {
          demoCells = demoCells.map((c, j) =>
            j === i ? { display: letter, resolved: true } : c,
          );
          // After last letter: show caption after 400ms, then restart after 2800ms
          if (i === DEMO_PLAIN.length - 1) {
            const t2 = setTimeout(() => {
              captionVisible = true;
              const t3 = setTimeout(runDemoAnimation, 2800); // loop
              demoTimeouts.push(t3);
            }, 400);
            demoTimeouts.push(t2);
          }
        },
        1200 + i * 380,
      );
      demoTimeouts.push(t);
    });
  }

  onMount(() => {
    runDemoAnimation(); // starts the loop
    return () => demoTimeouts.forEach(clearTimeout);
  });

  // ── Handlers ─────────────────────────────────────────────────
  async function handleRegister() {
    step = "registering";
    registrationError = "";
    try {
      const result = await registerPlayer();
      claimCode = result.claimCode;
      identity.setClaimCode(claimCode);
      step = "registered";
    } catch {
      registrationError = "Registration failed. Please try again.";
      step = "choose";
    }
  }

  function handleSkip() {
    identity.setSkipped();
    goto("/game");
  }

  function copyCode() {
    navigator.clipboard.writeText(claimCode).catch(() => {});
    copyFeedback = true;
    setTimeout(() => {
      copyFeedback = false;
    }, 2500);
  }

  function handleCodeInput(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const normalized = input.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    codeInput = normalized;
    input.value = normalized; // keep DOM in sync (two-way for uncontrolled inputs)
    codeError = "";
  }

  function submitCode() {
    const validated = validateClaimCode(codeInput);
    if (!validated) {
      codeError =
        "Code must be in WORD-WORD-0000 format (e.g. AMBER-HAWK-7842)";
      return; // AC1.9: does NOT navigate
    }
    identity.setClaimCode(validated);
    goto("/game");
  }

  function goBackToChoose() {
    step = "choose";
    codeInput = "";
    codeError = "";
  }
</script>

<svelte:head>
  <title>Unquote</title>
</svelte:head>

<!-- ── Landing ── -->
{#if step === "landing"}
  <main class="screen landing-inner">
    <p class="landing-eyebrow">A daily puzzle</p>
    <h1 class="landing-title">Unquote</h1>

    <p class="landing-tagline">
      Each day, a new quote — encrypted.<br />
      Substitute letters to reveal the hidden message.
    </p>

    <div
      class="demo-wrap"
      aria-label="Animation showing how cipher letters decode to plain text"
    >
      <div class="demo-cells" aria-hidden="true">
        {#each DEMO_CELLS as cell, i}
          <div class="demo-cell">
            <div class="demo-cell-input" class:resolved={demoCells[i].resolved}>
              {demoCells[i].display}
            </div>
            <span class="cell-cipher">{cell.cipher}</span>
          </div>
        {/each}
      </div>
      <p class="demo-caption" class:caption-visible={captionVisible}>
        Substitute every cipher letter to decode the quote
      </p>
    </div>

    <div class="landing-actions">
      <button class="btn-primary" onclick={() => (step = "choose")}>
        Play Today's Puzzle →
      </button>
      <p class="landing-sub">
        Returning player?
        <a
          href="/stats"
          onclick={(e) => {
            e.preventDefault();
            goto("/stats");
          }}>View your stats</a
        >
      </p>
    </div>
  </main>

  <!-- ── Choose ── -->
{:else if step === "choose"}
  <div class="screen">
    <header class="compact-header">
      <span class="compact-logo">Unquote</span>
      <button class="btn-back" onclick={() => (step = "landing")}>← Back</button
      >
    </header>
    <div class="onboarding-body">
      <div class="onboarding-heading">
        <p class="onboarding-eyebrow">Before you begin</p>
        <h2 class="onboarding-title">
          Would you like to<br /><em>track your stats?</em>
        </h2>
      </div>

      {#if registrationError}
        <p class="code-input-error" role="alert">{registrationError}</p>
      {/if}

      <div class="choice-stack">
        <!-- Register -->
        <div
          class="choice-card choice-primary"
          role="button"
          tabindex="0"
          onclick={handleRegister}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleRegister();
            }
          }}
        >
          <div class="choice-icon">✦</div>
          <div class="choice-body">
            <div class="choice-title">Yes — create an account</div>
            <div class="choice-desc">
              Get a claim code and track wins, streaks, and solve times across
              devices.
            </div>
          </div>
          <div class="choice-arrow">→</div>
        </div>

        <!-- Skip -->
        <div
          class="choice-card"
          role="button"
          tabindex="0"
          onclick={handleSkip}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleSkip();
            }
          }}
        >
          <div class="choice-icon">○</div>
          <div class="choice-body">
            <div class="choice-title">No thanks, just play</div>
            <div class="choice-desc">
              Play anonymously — no account needed, ever.
            </div>
          </div>
          <div class="choice-arrow">→</div>
        </div>

        <!-- Enter existing code -->
        <div
          class="choice-card"
          role="button"
          tabindex="0"
          onclick={() => (step = "enter-code")}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              step = "enter-code";
            }
          }}
        >
          <div class="choice-icon">⬡</div>
          <div class="choice-body">
            <div class="choice-title">I already have a claim code</div>
            <div class="choice-desc">
              Link your TUI or existing web account.
            </div>
          </div>
          <div class="choice-arrow">→</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Registering (spinner) ── -->
{:else if step === "registering"}
  <div class="screen">
    <header class="compact-header">
      <span class="compact-logo">Unquote</span>
    </header>
    <div class="registering-state">
      <span class="spinner" aria-label="Creating your account…"></span>
      <span>Creating your account…</span>
    </div>
  </div>

  <!-- ── Registered (claim code ticket) ── -->
{:else if step === "registered"}
  <div class="screen">
    <header class="compact-header">
      <span class="compact-logo">Unquote</span>
    </header>
    <div class="ticket-screen-body">
      <div class="ticket-heading">
        <p class="ticket-eyebrow green">✦ Registered ✦</p>
        <h2 class="ticket-title">Your claim code is ready</h2>
        <p class="ticket-subtitle">
          Save this — it links your stats across any device.
        </p>
      </div>

      <div class="ticket">
        <p class="ticket-label">— Your Claim Code —</p>
        <p class="ticket-code">{claimCode}</p>
        <div class="ticket-divider"></div>
        <p class="ticket-note">
          Write this down. Use it with <code>unquote link</code> in the TUI, or enter
          it here on any device.
        </p>
        <button
          class="btn-copy"
          class:copied={copyFeedback}
          aria-label={copyFeedback
            ? "Code copied to clipboard"
            : "Copy claim code to clipboard"}
          onclick={copyCode}
        >
          {copyFeedback ? "Copied ✓" : "Copy Code"}
        </button>
      </div>

      <div class="ticket-actions">
        <button class="btn-primary" onclick={() => goto("/game")}>
          Continue to Puzzle →
        </button>
        <button class="btn-ghost" onclick={() => goto("/game")}>
          I'll save it later
        </button>
      </div>
    </div>
  </div>

  <!-- ── Enter code ── -->
{:else if step === "enter-code"}
  <div class="screen">
    <header class="compact-header">
      <span class="compact-logo">Unquote</span>
      <button class="btn-back" onclick={goBackToChoose}>← Back</button>
    </header>
    <div class="ticket-screen-body">
      <div class="ticket-heading">
        <p class="ticket-eyebrow gold">Your Account</p>
        <h2 class="ticket-title">Enter your claim code</h2>
        <p class="ticket-subtitle">
          Paste or type the code you received when you registered.
        </p>
      </div>

      <div class="ticket ticket-gold" style="padding: 2rem 2.5rem 1.5rem">
        <p class="ticket-label">Claim Code</p>
        <input
          type="text"
          class="code-input-field"
          placeholder="WORD-WORD-0000"
          maxlength="20"
          autocomplete="off"
          spellcheck="false"
          value={codeInput}
          oninput={handleCodeInput}
          onkeydown={(e) => {
            if (e.key === "Enter") submitCode();
          }}
        />
        <div class="ticket-divider"></div>
        <p class="ticket-note">
          Your claim code looks like <strong>AMBER-HAWK-7842</strong>.<br />
          You received it when you registered from the TUI or web.
        </p>
        <button
          class="btn-copy"
          style="background:transparent;border-color:var(--color-gold-mid);color:var(--color-gold);margin-top:1rem;"
          onclick={submitCode}
        >
          Link Account →
        </button>
      </div>

      <p class="code-input-error" aria-live="polite">{codeError}</p>

      <button class="btn-ghost" onclick={handleSkip}
        >Skip — just play today</button
      >
    </div>
  </div>
{/if}

<style>
  /* ── Base screen ── */
  .screen {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--color-surface);
    color: var(--color-text-primary);
    font-family: var(--font-sans);
  }

  /* ── Landing ── */
  .landing-inner {
    justify-content: center;
    padding: 3rem 1.5rem;
    text-align: center;
    gap: 1.5rem;
  }

  .landing-eyebrow {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }

  .landing-title {
    font-family: var(--font-mono);
    font-size: clamp(2.8rem, 8vw, 4.5rem);
    font-weight: 700;
    letter-spacing: 0.12em;
    color: var(--color-gold);
    line-height: 1;
  }

  .landing-tagline {
    font-family: var(--font-display);
    font-style: italic;
    font-size: clamp(1.05rem, 2.5vw, 1.3rem);
    color: var(--color-text-primary);
    max-width: 480px;
    line-height: 1.55;
  }

  /* Demo cells */
  .demo-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1.5rem 0;
  }

  .demo-cells {
    display: flex;
    gap: 8px;
  }

  .demo-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 36px;
  }

  .demo-cell-input {
    font-family: var(--font-mono);
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--color-text-secondary);
    height: 1.5rem;
    line-height: 1.5rem;
    transition: color 0.3s ease;
  }

  .demo-cell-input.resolved {
    color: var(--color-gold);
  }

  .cell-cipher {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    letter-spacing: 0.04em;
    margin-top: 3px;
  }

  .demo-caption {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    letter-spacing: 0.05em;
    opacity: 0;
    transition: opacity 0.4s ease;
  }

  .demo-caption.caption-visible {
    opacity: 1;
  }

  .landing-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    margin-top: 0.5rem;
  }

  .landing-sub {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
  }

  .landing-sub a {
    color: var(--color-gold);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  /* ── Compact header (onboarding screens) ── */
  .compact-header {
    width: 100%;
    max-width: 560px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.2rem 1.5rem 0.8rem;
    border-bottom: 1px solid var(--color-border);
  }

  .compact-logo {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--color-gold);
  }

  /* ── Shared buttons ── */
  .btn-primary {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 0.75em 2em;
    background: var(--color-gold);
    color: var(--color-surface);
    border: none;
    border-radius: 3px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-primary:hover {
    background: var(--color-gold-bright);
  }

  .btn-back {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25em 0;
    transition: color 0.15s;
  }
  .btn-back:hover {
    color: var(--color-text-primary);
  }

  .btn-ghost {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    background: none;
    border: 1px solid var(--color-border-vis);
    border-radius: 3px;
    padding: 0.5em 1.5em;
    cursor: pointer;
    transition:
      color 0.15s,
      border-color 0.15s;
  }
  .btn-ghost:hover {
    color: var(--color-text-primary);
    border-color: var(--color-text-secondary);
  }

  /* ── Onboarding ── */
  .onboarding-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2.5rem 1.5rem;
    width: 100%;
    max-width: 480px;
    gap: 1.5rem;
  }

  .onboarding-heading {
    text-align: center;
  }

  .onboarding-eyebrow {
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    margin-bottom: 0.5rem;
  }

  .onboarding-title {
    font-family: var(--font-display);
    font-size: clamp(1.6rem, 4.5vw, 2.2rem);
    font-weight: 400;
    color: var(--color-text-primary);
    line-height: 1.3;
  }

  .onboarding-title em {
    color: var(--color-gold);
    font-style: italic;
  }

  .choice-stack {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }

  .choice-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: var(--color-surface-elevated);
    border: 1px solid var(--color-border-vis);
    border-radius: 8px;
    cursor: pointer;
    transition:
      border-color 0.15s,
      background 0.15s;
  }
  .choice-card:hover {
    border-color: var(--color-text-secondary);
    background: var(--color-surface-2);
  }

  .choice-card.choice-primary {
    border-color: var(--color-gold-mid);
    background: rgba(212, 161, 64, 0.04);
  }
  .choice-card.choice-primary:hover {
    border-color: var(--color-gold);
    background: rgba(212, 161, 64, 0.08);
  }

  .choice-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
  }
  .choice-body {
    flex: 1;
  }

  .choice-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: 0.2rem;
  }

  .choice-desc {
    font-size: 0.78rem;
    color: var(--color-text-secondary);
  }
  .choice-arrow {
    font-size: 1rem;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  /* ── Registering spinner ── */
  .registering-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: var(--color-text-secondary);
    font-size: 0.78rem;
  }

  .spinner {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 2px solid var(--color-border-vis);
    border-top-color: var(--color-gold);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ── Ticket screens ── */
  .ticket-screen-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2.5rem 1.5rem;
    gap: 1.5rem;
    width: 100%;
    max-width: 480px;
  }

  .ticket-heading {
    text-align: center;
  }

  .ticket-eyebrow {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    margin-bottom: 0.5rem;
  }
  .ticket-eyebrow.green {
    color: var(--color-green);
  }
  .ticket-eyebrow.gold {
    color: var(--color-gold);
  }

  .ticket-title {
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 4vw, 2rem);
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: 0.4rem;
  }

  .ticket-subtitle {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
  }

  .ticket {
    position: relative;
    border: 1.5px dashed var(--color-green-mid);
    border-radius: var(--r-lg);
    padding: 2rem 2.5rem;
    text-align: center;
    max-width: 400px;
    width: 100%;
    background: rgba(90, 170, 120, 0.03);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  /* Scalloped cutouts on the sides */
  .ticket::before,
  .ticket::after {
    content: "";
    position: absolute;
    width: 22px;
    height: 22px;
    background: var(--color-surface);
    border-radius: 50%;
    top: 50%;
    transform: translateY(-50%);
    border: 1.5px dashed var(--color-green-mid);
  }
  .ticket::before {
    left: -12px;
  }
  .ticket::after {
    right: -12px;
  }

  /* Gold variant (Screen 4) */
  .ticket.ticket-gold {
    border-color: var(--color-gold-mid);
    background: rgba(212, 161, 64, 0.02);
  }
  .ticket.ticket-gold::before,
  .ticket.ticket-gold::after {
    border-color: var(--color-gold-mid);
  }

  .ticket-label {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }

  .ticket-code {
    font-family: var(--font-mono);
    font-size: clamp(1.1rem, 3.5vw, 1.5rem);
    font-weight: 700;
    letter-spacing: 0.12em;
    color: var(--color-green);
  }

  .ticket-divider {
    width: 100%;
    height: 1px;
    background: var(--color-border-vis);
  }

  .ticket-note {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .ticket-note strong {
    color: var(--color-text-primary);
    font-weight: 600;
  }

  .btn-copy {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 0.45em 1.4em;
    background: var(--color-green-glow);
    border: 1px solid var(--color-green-border);
    border-radius: 3px;
    color: var(--color-green);
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s;
    margin-top: 0.75rem;
  }
  .btn-copy:hover {
    background: rgba(90, 170, 120, 0.18);
    border-color: var(--color-green);
  }
  .btn-copy.copied {
    color: var(--color-text-secondary);
    border-color: var(--color-text-border);
    background: transparent;
  }

  .ticket-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
  }

  /* ── Enter code input ── */
  .code-input-field {
    font-family: var(--font-mono);
    font-size: clamp(1.1rem, 3.5vw, 1.45rem);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-align: center;
    text-transform: uppercase;
    background: transparent;
    border: none;
    border-bottom: 2px solid var(--color-gold-mid);
    color: var(--color-gold);
    padding: 0.4em 0;
    width: 100%;
    max-width: 280px;
    outline: none;
    transition: border-color 0.15s;
    caret-color: var(--color-gold);
  }
  .code-input-field::placeholder {
    color: var(--color-text-secondary);
  }
  .code-input-field:focus {
    border-bottom-color: var(--color-gold);
  }

  .code-input-error {
    font-size: 0.7rem;
    color: var(--color-red);
    min-height: 1.2rem;
    text-align: center;
  }
</style>
