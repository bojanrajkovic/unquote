<script lang="ts">
  import { goto } from "$app/navigation";
  import { identity } from "$lib/state/identity.svelte.js";
  import type { StatsPageData } from "./+page.js";

  // Format milliseconds as M:SS (no leading zero on minutes) — e.g. "2:08".
  // Distinct from formatTimer() which zero-pads minutes.
  function fmtMs(ms: number): string {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  interface Props {
    data: StatsPageData;
  }

  const { data }: Props = $props();

  // ── Chart helpers ─────────────────────────────────────────────────────────

  /**
   * Build SVG path data + points for the 30-day solve-time chart.
   *
   * Returns:
   *  - segments:  array of SVG path strings for the line (split on null gaps)
   *  - areas:     matching gradient-fill path strings
   *  - dots:      { cx, cy, date, minutes } for each actual data point (circle markers)
   *  - yLabels:   { y (SVG coord), label (decimal minutes, e.g. "3.4") } for 3 y-axis ticks
   *  - gridLines: SVG <line> strings for horizontal grid lines at each tick
   */
  function buildChart(
    recentSolves: Array<{ date: string; completionTime: number }>,
  ) {
    // SVG viewport dimensions
    const W = 560;
    const H = 130;
    const pl = 42; // pad left
    const pr = 10; // pad right
    const pt = 10; // pad top
    const pb = 24; // pad bottom
    const iW = W - pl - pr; // inner width
    const iH = H - pt - pb; // inner height

    // Build a map: date string → completionTime (ms)
    const solveMap = new Map<string, number>();
    for (const s of recentSolves) {
      solveMap.set(s.date, s.completionTime);
    }

    // Build 30-day window (today back 29 days)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: Array<{ date: string; ms: number | null }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, ms: solveMap.get(key) ?? null });
    }

    // Collect valid (non-null) times to determine y scale
    const validMs = days
      .map((d) => d.ms)
      .filter((v): v is number => v !== null);
    if (validMs.length === 0) {
      return { segments: [], areas: [], dots: [], yLabels: [], gridLines: [] };
    }

    const minMs = Math.min(...validMs);
    const maxMs = Math.max(...validMs);
    // Add 10% headroom; guard against all-same-value (maxMs === minMs)
    const range =
      maxMs === minMs ? minMs * 0.2 || 60_000 : (maxMs - minMs) * 1.1;
    const yMin = Math.max(0, minMs - range * 0.05);
    const yMax = yMin + range;

    const xFor = (i: number) => pl + (i / 29) * iW;
    const yOf = (ms: number) => pt + iH - ((ms - yMin) / (yMax - yMin)) * iH;

    // Build contiguous segments (split wherever a day has no solve)
    type Point = { x: number; y: number };
    const segments: string[] = [];
    const areas: string[] = [];
    const dots: Array<{
      cx: number;
      cy: number;
      date: string;
      minutes: number;
    }> = [];

    let current: Point[] = [];

    const flushSegment = () => {
      if (current.length < 1) return;
      const lineParts = current.map(
        (p, j) => `${j === 0 ? "M" : "L"}${p.x},${p.y}`,
      );
      segments.push(lineParts.join(" "));
      // Area: line down to bottom, back to start, close
      const bottom = pt + iH;
      const areaClose = [
        `L${current[current.length - 1].x},${bottom}`,
        `L${current[0].x},${bottom}`,
        "Z",
      ].join(" ");
      areas.push(lineParts.join(" ") + " " + areaClose);
      current = [];
    };

    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      if (day.ms === null) {
        flushSegment();
      } else {
        const p = { x: xFor(i), y: yOf(day.ms) };
        current.push(p);
        dots.push({
          cx: p.x,
          cy: p.y,
          date: day.date,
          minutes: day.ms / 60000,
        });
      }
    }
    flushSegment();

    // 3 evenly-spaced y-axis tick labels (top, mid, bottom)
    // Y-axis shows decimal minutes (e.g. "3.4"), NOT MM:SS format
    const ticks = [0, 1, 2].map((t) => {
      const ms = yMax - (t / 2) * (yMax - yMin);
      const svgY = pt + (t / 2) * iH;
      const minutes = ms / 60000;
      return { y: svgY, minutes };
    });
    const yLabels = ticks.map(({ y, minutes }) => ({
      y,
      label: minutes.toFixed(1),
    }));

    // Horizontal grid lines at each y-axis tick
    const gridLines = ticks.map(
      ({ y }) =>
        `<line x1="${pl}" y1="${y.toFixed(1)}" x2="${pl + iW}" y2="${y.toFixed(1)}" stroke="var(--color-border)" stroke-width="0.5"/>`,
    );

    return { segments, areas, dots, yLabels, gridLines, pl, iW, iH: H };
  }

  // ── Derived chart data ────────────────────────────────────────────────────

  const chart = $derived(
    data.stats ? buildChart(data.stats.recentSolves) : null,
  );
</script>

<svelte:head>
  <title>Unquote — Stats</title>
</svelte:head>

<div class="stats-screen">
  <header class="compact-header">
    <span class="compact-logo">Unquote</span>
    <a href="/game" class="btn-back">← Today's Puzzle</a>
  </header>

  {#if data.error}
    <!-- API error state -->
    <div class="empty-state">
      <p class="empty-message error-message">{data.error}</p>
    </div>
  {:else if !data.stats}
    <!-- Anonymous empty state (no claim code) — AC4.6 -->
    <div class="empty-state">
      <p class="empty-message">Stats are saved when you create an account.</p>
      <button class="register-cta" onclick={() => goto("/")}>
        create account
      </button>
    </div>
  {:else}
    <!-- Stats heading: title + inline claim code — AC1.7 -->
    <div class="stats-heading">
      <span class="stats-title">Your Statistics</span>
      <span class="stats-claim-code">{identity.claimCode ?? ""}</span>
    </div>

    <!-- Primary stat tiles — AC1.7 -->
    <div class="primary-grid">
      <div class="stat-tile">
        <span class="stat-value">{data.stats.gamesPlayed}</span>
        <span class="stat-label">played</span>
      </div>
      <div class="stat-tile">
        <span class="stat-value">{data.stats.gamesSolved}</span>
        <span class="stat-label">solved</span>
      </div>
      <div class="stat-tile">
        <span class="stat-value">{Math.round(data.stats.winRate * 100)}%</span>
        <span class="stat-label">win rate</span>
      </div>
      <div class="stat-tile">
        <span class="stat-value">{data.stats.currentStreak}🔥</span>
        <span class="stat-label">streak</span>
      </div>
    </div>

    <!-- SVG line chart (last 30 days) — AC1.7 -->
    {#if chart && chart.dots.length > 0}
      <div class="chart-panel">
        <p class="chart-title">Solve Times — Last 30 Days (minutes)</p>
        <svg
          class="chart-svg"
          viewBox="0 0 560 130"
          preserveAspectRatio="none"
          aria-label="Solve times over the last 30 days"
          role="img"
        >
          <defs>
            <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stop-color="var(--color-teal)"
                stop-opacity="0.7"
              />
              <stop
                offset="100%"
                stop-color="var(--color-teal)"
                stop-opacity="0"
              />
            </linearGradient>
          </defs>

          <!-- Horizontal grid lines at each y-axis tick -->
          {#each chart.gridLines as gl}
            {@html gl}
          {/each}

          <!-- Gradient areas (one per contiguous segment) -->
          {#each chart.areas as area}
            <path d={area} fill="url(#cg)" />
          {/each}

          <!-- Line paths -->
          {#each chart.segments as seg}
            <path
              d={seg}
              fill="none"
              stroke="var(--color-teal)"
              stroke-width="1.5"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          {/each}

          <!-- Data point dots with tooltips -->
          {#each chart.dots as dot}
            <circle cx={dot.cx} cy={dot.cy} r="2.5" fill="var(--color-teal)">
              <title>{dot.date}: {dot.minutes.toFixed(1)}m</title>
            </circle>
          {/each}

          <!-- Y-axis labels (decimal minutes, e.g. "3.4") -->
          {#each chart.yLabels as tick}
            <text
              x="38"
              y={tick.y + 4}
              text-anchor="end"
              font-size="9"
              fill="var(--color-text-muted)"
              font-family="'Space Mono',monospace">{tick.label}</text
            >
          {/each}

          <!-- X-axis label -->
          <text
            x={(chart?.pl ?? 0) + (chart?.iW ?? 0) / 2}
            y={(chart?.iH ?? 0) - 4}
            text-anchor="middle"
            font-size="9"
            fill="var(--color-text-muted)"
            font-family="'DM Sans',sans-serif">← 30 days ago · today →</text
          >
        </svg>
      </div>
    {/if}

    <!-- Secondary stats: grouped Streaks and Times cards — AC1.7 -->
    <div class="stats-secondary">
      <!-- Streaks card -->
      <div class="stat-row">
        <div class="stat-row-label">Streaks</div>
        <div class="stat-row-values">
          <div class="stat-kv">
            <span class="stat-kv-key">Current streak</span>
            <span class="stat-kv-val highlight">{data.stats.currentStreak}</span
            >
          </div>
          <div class="stat-kv">
            <span class="stat-kv-key">Best streak</span>
            <span class="stat-kv-val">{data.stats.bestStreak}</span>
          </div>
        </div>
      </div>
      <!-- Times card -->
      <div class="stat-row">
        <div class="stat-row-label">Times</div>
        <div class="stat-row-values">
          <div class="stat-kv">
            <span class="stat-kv-key">Best solve</span>
            <span class="stat-kv-val highlight">
              {data.stats.bestTime !== null ? fmtMs(data.stats.bestTime) : "—"}
            </span>
          </div>
          <div class="stat-kv">
            <span class="stat-kv-key">Average time</span>
            <span class="stat-kv-val">
              {data.stats.averageTime !== null
                ? fmtMs(data.stats.averageTime)
                : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .stats-screen {
    min-height: 100dvh;
    background: var(--color-surface);
    padding: 1.5rem 1rem 3rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    max-width: 640px;
    margin: 0 auto;
  }

  /* Compact header (shared pattern) */
  .compact-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .compact-logo {
    font-family: var(--font-display);
    font-size: 1rem;
    color: var(--color-text-primary);
    letter-spacing: 0.05em;
  }

  .btn-back {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-text-muted);
    text-decoration: none;
    transition: color 0.15s;
  }
  .btn-back:hover {
    color: var(--color-gold);
  }

  /* Stats heading: title + inline claim code */
  .stats-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }

  .stats-title {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--color-text-primary);
  }

  .stats-claim-code {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--color-text-muted);
    letter-spacing: 0.05em;
  }

  /* Primary grid */
  .primary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
  }

  @media (max-width: 400px) {
    .primary-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .stat-tile {
    background: var(--color-surface-elevated);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    padding: 1rem 0.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .stat-value {
    font-family: var(--font-display);
    font-size: 2rem;
    color: var(--color-gold);
    line-height: 1;
  }

  .stat-label {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  /* Chart */
  .chart-panel {
    background: var(--color-surface-elevated);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    padding: 1rem;
  }

  .chart-title {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    margin: 0 0 0.75rem;
  }

  .chart-svg {
    width: 100%;
    height: auto;
    display: block;
  }

  /* Secondary stats: grouped Streaks and Times cards */
  .stats-secondary {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .stat-row {
    background: var(--color-surface-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--r-lg, 0.75rem);
    padding: 0.9rem 1rem;
  }

  .stat-row-label {
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    margin-bottom: 0.35rem;
  }

  .stat-row-values {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stat-kv {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .stat-kv-key {
    font-size: 0.72rem;
    color: var(--color-text-muted);
  }

  .stat-kv-val {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .stat-kv-val.highlight {
    color: var(--color-gold);
  }

  /* Empty state */
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 3rem 1rem;
    text-align: center;
  }

  .empty-message {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--color-text-muted);
    max-width: 280px;
    line-height: 1.6;
    margin: 0;
  }

  .error-message {
    color: var(--color-red);
  }

  .register-cta {
    background: none;
    border: 1px solid var(--color-gold);
    color: var(--color-gold);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 0.625rem 1.5rem;
    border-radius: 0.25rem;
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s;
  }
  .register-cta:hover {
    background: var(--color-gold);
    color: var(--color-surface);
  }
</style>
