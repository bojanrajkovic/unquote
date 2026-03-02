<script lang="ts">
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  import { goto } from "$app/navigation";
  import { registerPlayer } from "$lib/api.js";
  import { identity } from "$lib/state/identity.svelte.js";
  import { validateClaimCode } from "$lib/claim-code.js";

  const TRANSITION_MS = 220;

  // ── Step state machine ──────────────────────────────────────
  // ssr = false, so window is always available at script init time.
  // ?action=register skips the landing page (used by /stats "create account").
  type Step =
    | "landing"
    | "choose"
    | "registering"
    | "registered"
    | "enter-code";
  const initialStep: Step =
    new URLSearchParams(window.location.search).get("action") === "register"
      ? "choose"
      : "landing";
  let step = $state<Step>(initialStep);

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
    { cipher: "G", plain: "O" },
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
    identity.completeOnboarding();
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

<!-- Onboarded players redirect to /game via +page.ts; guard prevents flash -->
{#if identity.hasOnboarded}
  <!-- empty: redirect in flight -->
{:else if step === "landing"}
  <main
    class="screen landing-inner"
    in:fly={{ y: 8, duration: TRANSITION_MS, delay: TRANSITION_MS }}
    out:fly={{ y: -8, duration: TRANSITION_MS }}
  >
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
            <span class="demo-cell-cipher">{cell.cipher}</span>
          </div>
        {/each}
      </div>
      <p class="demo-caption" class:caption-visible={captionVisible}>
        Substitute every cipher letter to decode the quote
      </p>
    </div>

    <div class="landing-actions">
      <button
        class="btn-primary"
        onclick={() =>
          identity.hasOnboarded ? goto("/game") : (step = "choose")}
      >
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
        · <a href="/faq">FAQ</a>
      </p>
    </div>
  </main>

  <!-- ── Choose ── -->
{:else if step === "choose"}
  <div
    class="screen screen-padded"
    in:fly={{ y: 8, duration: TRANSITION_MS, delay: TRANSITION_MS }}
    out:fly={{ y: -8, duration: TRANSITION_MS }}
  >
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
  <div
    class="screen"
    in:fly={{ y: 8, duration: TRANSITION_MS, delay: TRANSITION_MS }}
    out:fly={{ y: -8, duration: TRANSITION_MS }}
  >
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
  <div
    class="screen"
    in:fly={{ y: 8, duration: TRANSITION_MS, delay: TRANSITION_MS }}
    out:fly={{ y: -8, duration: TRANSITION_MS }}
  >
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
        <button
          class="btn-primary"
          onclick={() => {
            identity.completeOnboarding();
            goto("/game");
          }}
        >
          Continue to Puzzle →
        </button>
        <button
          class="btn-ghost"
          onclick={() => {
            identity.completeOnboarding();
            goto("/game");
          }}
        >
          I'll save it later
        </button>
      </div>
    </div>
  </div>

  <!-- ── Enter code ── -->
{:else if step === "enter-code"}
  <div
    class="screen"
    in:fly={{ y: 8, duration: TRANSITION_MS, delay: TRANSITION_MS }}
    out:fly={{ y: -8, duration: TRANSITION_MS }}
  >
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

      <div class="ticket ticket-gold ticket-input">
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
            if (e.key === "Enter") {
              submitCode();
            }
          }}
        />
        <div class="ticket-divider"></div>
        <p class="ticket-note">
          Your claim code looks like <strong>AMBER-HAWK-7842</strong>.<br />
          You received it when you registered from the TUI or web.
        </p>
        <button class="btn-copy btn-link-account" onclick={submitCode}>
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
  }

  /* ── Landing ── */
  .landing-inner {
    justify-content: center;
    padding: 3rem 1.25rem 4rem;
    text-align: center;
  }

  .landing-eyebrow {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.42em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    margin-bottom: 1.75rem;
  }

  .landing-title {
    font-family: var(--font-mono);
    font-size: clamp(2rem, 7vw, 3.2rem);
    font-weight: 700;
    letter-spacing: 0.28em;
    color: var(--color-gold);
    text-transform: uppercase;
    line-height: 1;
    position: relative;
    padding-bottom: 0.5em;
  }
  .landing-title::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 3rem;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--color-gold-mid),
      transparent
    );
  }

  .landing-tagline {
    font-family: var(--font-display);
    font-style: italic;
    font-size: clamp(1.1rem, 2.5vw, 1.35rem);
    color: var(--color-text-primary);
    margin-top: 1.4rem;
    line-height: 1.6;
    max-width: 380px;
    text-wrap: balance;
  }

  /* Demo cells */
  .demo-wrap {
    margin: 2.5rem 0 0.5rem;
  }

  .demo-cells {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .demo-cell {
    width: 44px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
  }

  .demo-cell-input {
    font-family: var(--font-mono);
    font-size: 1.3rem;
    font-weight: 700;
    height: 40px;
    width: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1.5px solid var(--color-text-border);
    color: var(--color-text-muted);
    transition:
      color 0.15s,
      border-color 0.2s;
  }

  .demo-cell-input.resolved {
    color: var(--color-gold);
    border-bottom-color: var(--color-gold-mid);
  }

  .demo-cell-cipher {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--color-teal-mid);
  }

  .demo-caption {
    font-size: 0.7rem;
    color: var(--color-text-secondary);
    letter-spacing: 0.06em;
    margin-top: 0.85rem;
    opacity: 0;
    transition: opacity 0.5s ease;
    text-align: center;
  }

  .demo-caption.caption-visible {
    opacity: 1;
  }

  .landing-actions {
    margin-top: 2.75rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.9rem;
  }

  .landing-sub {
    font-size: 0.7rem;
    color: var(--color-text-secondary);
  }

  .landing-sub a {
    color: var(--color-text-secondary);
    text-decoration: none;
    border-bottom: 1px solid var(--color-text-border);
    cursor: pointer;
    transition: color 0.15s;
  }
  .landing-sub a:hover {
    color: var(--color-text-primary);
  }

  /* ── Onboarding ── */
  .onboarding-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 2.5rem 1.25rem;
    max-width: 500px;
    width: 100%;
  }

  .onboarding-heading {
    margin-bottom: 2rem;
  }

  .onboarding-eyebrow {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    letter-spacing: 0.35em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    margin-bottom: 0.65rem;
  }

  .onboarding-title {
    font-family: var(--font-display);
    font-size: 1.7rem;
    font-weight: 400;
    line-height: 1.3;
    color: var(--color-text-primary);
  }

  .onboarding-title em {
    color: var(--color-gold);
    font-style: italic;
  }

  .choice-stack {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .choice-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.1rem 1.25rem;
    border: 1px solid var(--color-border);
    border-radius: var(--r-lg);
    cursor: pointer;
    transition:
      border-color 0.15s,
      background 0.15s,
      transform 0.12s;
    background: rgba(255, 255, 255, 0.01);
  }
  .choice-card:hover {
    border-color: rgba(212, 161, 64, 0.28);
    background: rgba(212, 161, 64, 0.04);
    transform: translateX(4px);
  }

  .choice-card.choice-primary {
    border-color: var(--color-gold-mid);
  }
  .choice-card.choice-primary .choice-icon {
    color: var(--color-gold);
  }

  .choice-icon {
    font-size: 1rem;
    width: 22px;
    text-align: center;
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }
  .choice-body {
    flex: 1;
  }

  .choice-title {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--color-text-primary);
    margin-bottom: 0.2rem;
  }

  .choice-desc {
    font-size: 0.72rem;
    color: var(--color-text-secondary);
    line-height: 1.4;
  }
  .choice-arrow {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--color-text-border);
    transition:
      color 0.15s,
      transform 0.15s;
    flex-shrink: 0;
  }
  .choice-card:hover .choice-arrow {
    color: var(--color-gold);
    transform: translateX(3px);
  }

  /* ── Registering spinner ── */
  .registering-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 3rem;
    color: var(--color-text-secondary);
    font-size: 0.78rem;
  }

  .spinner {
    display: inline-block;
    width: 18px;
    height: 18px;
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
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1.25rem 3rem;
    gap: 2rem;
    width: 100%;
  }

  .ticket-heading {
    text-align: center;
  }

  .ticket-eyebrow {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.38em;
    text-transform: uppercase;
    margin-bottom: 0.6rem;
  }
  .ticket-eyebrow.green {
    color: var(--color-green);
  }
  .ticket-eyebrow.gold {
    color: var(--color-gold);
  }

  .ticket-title {
    font-family: var(--font-display);
    font-size: 1.55rem;
    font-weight: 400;
    color: var(--color-text-primary);
  }

  .ticket-subtitle {
    font-size: 0.78rem;
    color: var(--color-text-secondary);
    margin-top: 0.4rem;
    line-height: 1.5;
  }

  .ticket {
    position: relative;
    border: 1.5px dashed var(--color-green-mid);
    border-radius: var(--r-lg);
    padding: 2rem 2.5rem;
    text-align: center;
    max-width: 460px;
    width: 100%;
    background: rgba(90, 170, 120, 0.03);
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
    font-family: var(--font-mono);
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    margin-bottom: 0.75rem;
  }

  .ticket-code {
    font-family: var(--font-mono);
    font-size: clamp(1rem, 3.5vw, 1.45rem);
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--color-green);
    word-break: keep-all;
    white-space: nowrap;
  }

  .ticket-divider {
    height: 1px;
    background: var(--color-green-border);
    margin: 1.1rem 0;
    opacity: 0.5;
  }

  .ticket-note {
    font-size: 0.75rem;
    color: var(--color-text-primary);
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
    background: rgba(90, 170, 120, 0.1);
    border: 1px solid var(--color-green-border);
    border-radius: var(--r);
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
    max-width: 460px;
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

  .screen-padded {
    padding-bottom: 3rem;
  }

  .ticket-input {
    padding: 2rem 2.5rem 1.5rem;
  }

  .btn-link-account {
    background: transparent;
    border-color: var(--color-gold-mid);
    color: var(--color-gold);
    margin-top: 1rem;
  }
</style>
