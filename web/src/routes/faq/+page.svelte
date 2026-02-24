<script lang="ts">
  import { onMount } from "svelte";

  // ── FAQ data ────────────────────────────────────────────────────────────

  interface FaqItem {
    q: string;
    a: string;
  }

  interface FaqSection {
    key: string;
    icon: string;
    eyebrow: string;
    title: string;
    items: FaqItem[];
  }

  // ── Midnight UTC → local time (progressive enhancement) ────────────────
  onMount(() => {
    const el = document.querySelector(".midnight-local");
    if (el) {
      const d = new Date();
      d.setUTCHours(24, 0, 0, 0);
      const local = d.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
      el.textContent = ` (${local} your time)`;
    }
  });

  const sections: FaqSection[] = [
    {
      key: "gameplay",
      icon: "?",
      eyebrow: "Gameplay",
      title: "How to Play",
      items: [
        {
          q: "What is Unquote?",
          a: "A daily cryptoquip puzzle: each day, a new quote is encrypted by substituting every letter with a different one. Your job is to reverse the cipher and decode the hidden message.",
        },
        {
          q: "How do I solve a puzzle?",
          a: 'Click a cell, type a letter. All cells sharing the same cipher letter update together. Fill in every letter and press <span class="faq-btn-ref">Check Answer</span> (or hit <kbd>Enter</kbd>).',
        },
        {
          q: "What do the colors mean?",
          a: '<ul><li><strong class="color-gold">Gold</strong> — the cell you\'re currently editing</li><li><strong class="color-teal">Teal</strong> — other cells with the same cipher letter</li><li><strong class="color-amber">Amber</strong> — a conflict (two different cipher letters mapped to the same plain letter)</li><li><strong class="color-green">Green</strong> — correct (shown during the solved animation)</li></ul>',
        },
        {
          q: "What are hints?",
          a: "Pre-revealed letter mappings shown as teal chips above the grid. Hint cells are pre-filled and can't be edited — they give you a head start.",
        },
        {
          q: "What keyboard shortcuts are available?",
          a: "<kbd>←</kbd> <kbd>→</kbd> or <kbd>Tab</kbd> to move between cells. <kbd>Backspace</kbd> to clear the current cell. <kbd>Enter</kbd> to submit your answer. <kbd>Ctrl</kbd>+<kbd>C</kbd> to clear all guesses.",
        },
        {
          q: "What does the difficulty rating mean?",
          a: 'A 0\u2013100 score based on quote length, letter patterns, and word variety. It\'s displayed as a badge: <span class="faq-badge easy">Easy</span>, <span class="faq-badge medium">Medium</span>, <span class="faq-badge hard">Hard</span>, or <span class="faq-badge expert">Expert</span>.',
        },
        {
          q: "What happens when I solve the puzzle?",
          a: 'A green reveal animation plays across the grid, then a "Decoded" card appears showing the original quote, its attribution, and your solve time. If you\'re registered, the session is recorded automatically.',
        },
        {
          q: "What if my answer is wrong?",
          a: "You'll see a \"Not quite\" message. There's no penalty — keep trying until you get it.",
        },
        {
          q: "Can I play previous days' puzzles?",
          a: "Not yet from the web app. This may be added in the future.",
        },
      ],
    },
    {
      key: "accounts",
      icon: "✦",
      eyebrow: "Accounts",
      title: "Claim Codes & Accounts",
      items: [
        {
          q: "Do I need an account to play?",
          a: "No. Accounts are entirely optional — they're only for tracking stats across sessions and devices.",
        },
        {
          q: "What is a claim code?",
          a: "A portable identifier in <code>WORD-WORD-0000</code> format (e.g. <code>AMBER-HAWK-7842</code>). It links your stats without requiring an email or password.",
        },
        {
          q: "How do I register?",
          a: 'Choose <span class="faq-btn-ref">Yes — create an account</span> on the onboarding screen, or click <span class="faq-btn-ref">create account</span> on the Stats page.',
        },
        {
          q: "I have a claim code from the terminal app.",
          a: 'Choose <span class="faq-btn-ref">I already have a claim code</span> on the onboarding screen and enter it to link your existing account.',
        },
        {
          q: "What if I lose my claim code?",
          a: "Check your browser's <code>localStorage</code> or run <code>unquote claim-code</code> in the terminal app. There's no recovery mechanism if the code is lost from all devices.",
        },
        {
          q: "Can I change my claim code?",
          a: "No. Claim codes are randomly generated and permanent.",
        },
      ],
    },
    {
      key: "stats",
      icon: "#",
      eyebrow: "Stats",
      title: "Stats & Streaks",
      items: [
        {
          q: "What stats are tracked?",
          a: "Games played and solved, win rate, current and best streak, best and average solve times, and a 30-day chart of solve times.",
        },
        {
          q: "How are streaks calculated?",
          a: "A streak counts consecutive calendar days with at least one solve. Missing a day resets your streak to zero.",
        },
        {
          q: "Do stats update immediately?",
          a: "Yes. Your session is sent to the server as soon as you solve. Stats reflect it on your next visit. Recording failures never block the solved card.",
        },
        {
          q: 'Why does the stats page say "create an account"?',
          a: 'You\'re playing anonymously. Click <span class="faq-btn-ref">create account</span> to register and start tracking your stats.',
        },
      ],
    },
    {
      key: "crossdevice",
      icon: "⬡",
      eyebrow: "Cross-Device",
      title: "Cross-Device & TUI",
      items: [
        {
          q: "What is the TUI?",
          a: "A terminal client for macOS, Linux, and Windows. Same daily puzzles, same server — just in your terminal.",
        },
        {
          q: "How do I install the TUI?",
          a: 'Download the latest release for your platform from the <a href="https://github.com/bojanrajkovic/unquote/releases" target="_blank" rel="noopener noreferrer">GitHub releases page</a>. Extract the archive and place the <code>unquote</code> binary somewhere on your <code>PATH</code>.',
        },
        {
          q: "Can I play on both web and terminal?",
          a: "Yes. Use the same claim code on both. Run <code>unquote link</code> in the terminal to enter your code.",
        },
        {
          q: "Do both clients show the same puzzle?",
          a: "Yes. The daily puzzle is deterministic from the date — every player sees the same puzzle.",
        },
        {
          q: "Can I continue in-progress guesses on another device?",
          a: "No. Guesses are saved locally on each device. Only completed stats sync via the server.",
        },
      ],
    },
    {
      key: "privacy",
      icon: "◇",
      eyebrow: "Privacy",
      title: "Privacy & Data",
      items: [
        {
          q: "What data do you store?",
          a: "Locally: your claim code, onboarding status, and puzzle progress. Server-side: your claim code and completed sessions (date + solve time) — only if you've registered.",
        },
        {
          q: "Is my claim code like a password?",
          a: "More like a username. Someone with your code could view your stats, but there's no sensitive data behind it.",
        },
        {
          q: "Can I delete my data?",
          a: "Clear your browser data to remove local state. For server-side deletion, contact the developer.",
        },
        {
          q: "Does the game use cookies or tracking?",
          a: "No cookies, no analytics, no tracking. All client-side state uses <code>localStorage</code>.",
        },
      ],
    },
    {
      key: "general",
      icon: "○",
      eyebrow: "General",
      title: "General",
      items: [
        {
          q: "How often is a new puzzle available?",
          a: 'One per day at midnight UTC<span class="midnight-local"></span>. The puzzle is deterministic from the date, so all players see the same one.',
        },
        {
          q: "Who makes the puzzles?",
          a: "They're generated algorithmically from a curated quote collection — cipher shuffling plus difficulty scoring.",
        },
        {
          q: 'Why is it called "Unquote"?',
          a: 'You\'re "un-quoting" — reversing the encryption to reveal the hidden quote.',
        },
        {
          q: "Is Unquote open source?",
          a: 'Yes. The source code is available on <a href="https://github.com/bojanrajkovic/unquote" target="_blank" rel="noopener noreferrer">GitHub</a>.',
        },
        {
          q: "I found a bug or have feedback.",
          a: 'File an issue on the <a href="https://github.com/bojanrajkovic/unquote/issues" target="_blank" rel="noopener noreferrer">GitHub issues page</a>.',
        },
      ],
    },
  ];

  // ── Accordion state: one open card per section ──────────────────────────

  let openCards = $state<Record<string, number | null>>(
    Object.fromEntries(sections.map((s) => [s.key, null])),
  );

  function toggle(sectionKey: string, index: number) {
    openCards[sectionKey] = openCards[sectionKey] === index ? null : index;
  }
</script>

<svelte:head>
  <title>Unquote — FAQ</title>
</svelte:head>

<div class="faq-screen">
  <header class="compact-header">
    <span class="compact-logo">Unquote</span>
    <a href="/game" class="btn-back">← Today's Puzzle</a>
  </header>

  <div class="faq-body">
    <div class="faq-heading">
      <p class="faq-eyebrow">Frequently Asked Questions</p>
      <h1 class="faq-title">What would you like to know?</h1>
    </div>

    {#each sections as section}
      <div class="faq-section">
        <p class="section-eyebrow">{section.eyebrow}</p>
        <h2 class="section-title">{section.title}</h2>

        <div class="faq-cards">
          {#each section.items as item, i}
            {@const expanded = openCards[section.key] === i}
            {@const answerId = `faq-${section.key}-${i}`}
            <div
              class="faq-card"
              class:expanded
              role="button"
              tabindex="0"
              aria-expanded={expanded}
              aria-controls={answerId}
              onclick={() => toggle(section.key, i)}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle(section.key, i);
                }
              }}
            >
              <div class="faq-question">
                <span class="faq-icon">{section.icon}</span>
                <span class="faq-q-text">{item.q}</span>
                <span class="faq-chevron">▸</span>
              </div>
              <div class="faq-answer" id={answerId}>
                <p>{@html item.a}</p>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .faq-screen {
    min-height: 100dvh;
    background: var(--color-surface);
    display: flex;
    flex-direction: column;
  }

  .faq-body {
    width: 100%;
    max-width: 660px;
    margin: 0 auto;
    padding: 1.75rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .faq-heading {
    margin-bottom: 0.25rem;
  }

  .faq-eyebrow {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.35em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    margin-bottom: 0.65rem;
  }

  .faq-title {
    font-family: var(--font-display);
    font-size: 1.7rem;
    font-weight: 400;
    line-height: 1.3;
    color: var(--color-text-primary);
    margin: 0;
  }

  /* ── Sections ── */
  .faq-section {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .section-eyebrow {
    font-family: var(--font-mono);
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .section-title {
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .faq-cards {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* ── Card ── */
  .faq-card {
    border: 1px solid var(--color-border);
    border-radius: var(--r-lg);
    padding: 1.1rem 1.25rem;
    cursor: pointer;
    transition:
      border-color 0.15s,
      background 0.15s,
      transform 0.12s;
    background: rgba(255, 255, 255, 0.01);
  }

  .faq-card:hover:not(.expanded) {
    border-color: rgba(212, 161, 64, 0.28);
    background: rgba(212, 161, 64, 0.04);
    transform: translateX(4px);
  }

  .faq-card.expanded {
    border-color: rgba(212, 161, 64, 0.28);
  }

  /* ── Question row ── */
  .faq-question {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }

  .faq-icon {
    font-size: 1rem;
    width: 22px;
    text-align: center;
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }

  .faq-card.expanded .faq-icon {
    color: var(--color-gold);
  }

  .faq-q-text {
    flex: 1;
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .faq-chevron {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--color-text-border);
    flex-shrink: 0;
    transition: transform 0.3s ease;
    display: flex;
    align-items: center;
  }

  .faq-card.expanded .faq-chevron {
    transform: rotate(90deg);
  }

  /* ── Answer (accordion) ── */
  .faq-answer {
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    transition:
      max-height 0.3s ease,
      opacity 0.25s ease,
      padding 0.3s ease;
  }

  .faq-card.expanded .faq-answer {
    max-height: 20rem;
    opacity: 1;
    padding-top: 0.75rem;
  }

  .faq-answer p {
    font-family: var(--font-sans);
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    line-height: 1.55;
    margin: 0;
    padding-left: calc(22px + 0.85rem);
  }

  .faq-answer :global(ul) {
    list-style: disc;
    margin: 0;
    padding-left: 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .faq-answer :global(li) {
    font-family: var(--font-sans);
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    line-height: 1.55;
  }

  .faq-answer :global(li::marker) {
    color: var(--color-text-border);
  }

  .faq-answer :global(strong) {
    font-weight: 600;
  }

  .faq-answer :global(.color-gold) {
    color: var(--color-gold);
  }
  .faq-answer :global(.color-teal) {
    color: var(--color-teal);
  }
  .faq-answer :global(.color-amber) {
    color: var(--color-amber);
  }
  .faq-answer :global(.color-green) {
    color: var(--color-green);
  }

  .faq-answer :global(code) {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    background: rgba(255, 255, 255, 0.05);
    padding: 0.15em 0.4em;
    border-radius: 2px;
  }

  /* Keyboard key styling */
  .faq-answer :global(kbd) {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border-vis);
    border-bottom-width: 2px;
    border-radius: 3px;
    padding: 0.1em 0.4em;
    color: var(--color-text-secondary);
  }

  /* Inline button reference */
  .faq-answer :global(.faq-btn-ref) {
    font-family: var(--font-sans);
    font-weight: 600;
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border: 1px solid var(--color-gold-mid);
    color: var(--color-gold);
    border-radius: var(--r);
    padding: 0.15em 0.5em;
    margin: 0.2em 0;
    display: inline-block;
  }

  /* Difficulty badges (matching game page) */
  .faq-answer :global(.faq-badge) {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    padding: 0.18em 0.55em;
    border-radius: 2px;
    display: inline-block;
  }
  .faq-answer :global(.faq-badge.easy) {
    background: rgba(90, 170, 120, 0.13);
    color: var(--color-green);
  }
  .faq-answer :global(.faq-badge.medium) {
    background: rgba(212, 161, 64, 0.12);
    color: var(--color-gold);
  }
  .faq-answer :global(.faq-badge.hard) {
    background: rgba(192, 128, 64, 0.14);
    color: var(--color-amber);
  }
  .faq-answer :global(.faq-badge.expert) {
    background: rgba(191, 87, 87, 0.15);
    color: var(--color-red);
  }

  .faq-answer :global(a) {
    color: var(--color-text-secondary);
    text-decoration: none;
    border-bottom: 1px solid var(--color-text-border);
    transition: color 0.15s;
  }
  .faq-answer :global(a:hover) {
    color: var(--color-text-primary);
  }
</style>
