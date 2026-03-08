<script lang="ts">
  import type { PlayerStats } from "../api";

  export interface Props {
    stats: PlayerStats;
  }

  const { stats }: Props = $props();

  function fmtMs(ms: number): string {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  // Build sparkline points from recentSolves
  const sparklinePoints = $derived.by(() => {
    const solves = stats.recentSolves;
    if (solves.length < 2) return "";

    const times = solves.map((s) => s.completionTime);
    const max = Math.max(...times);
    const min = Math.min(...times);
    const range = max - min || 1;

    const w = 300;
    const h = 60;

    return times
      .map((t, i) => {
        const x = (i / (times.length - 1)) * w;
        const y = h - ((t - min) / range) * h;
        return `${x},${y}`;
      })
      .join(" ");
  });

  const winRatePercent = $derived(Math.round(stats.winRate * 100));
</script>

<div
  data-testid="stats-card"
  style="
    width: 1200px;
    height: 628px;
    background-color: #0c0c18;
    color: #eae0ca;
    font-family: 'Space Mono', monospace;
    display: flex;
    flex-direction: column;
    padding: 0;
    box-sizing: border-box;
  "
>
  <!-- Top bar -->
  <div
    style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 32px;
      height: 80px;
      border-bottom: 1px solid #2a2a3e;
    "
  >
    <span style="font-weight: 700; color: #d4a140; font-size: 28px;"
      >UNQUOTE</span
    >
    <span style="font-weight: 400; color: #8a8aa4; font-size: 14px;"
      >PLAYER STATS</span
    >
  </div>

  <!-- Center content: 2x2 grid of stats -->
  <div
    style="
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      padding: 32px;
      flex: 1;
      align-content: center;
    "
  >
    <!-- Games Played -->
    <div style="text-align: center;">
      <div
        style="
          font-weight: 700;
          font-size: 56px;
          color: #d4a140;
          margin-bottom: 8px;
        "
      >
        {stats.gamesPlayed}
      </div>
      <div style="font-weight: 400; font-size: 16px; color: #8a8aa4;">
        Games Played
      </div>
    </div>

    <!-- Win Rate -->
    <div style="text-align: center;">
      <div
        style="
          font-weight: 700;
          font-size: 56px;
          color: #d4a140;
          margin-bottom: 8px;
        "
      >
        {winRatePercent}%
      </div>
      <div style="font-weight: 400; font-size: 16px; color: #8a8aa4;">
        Win Rate
      </div>
    </div>

    <!-- Current Streak -->
    <div style="text-align: center;">
      <div
        style="
          font-weight: 700;
          font-size: 56px;
          color: #d4a140;
          margin-bottom: 8px;
        "
      >
        {stats.currentStreak}
      </div>
      <div style="font-weight: 400; font-size: 16px; color: #8a8aa4;">
        Current Streak
      </div>
    </div>

    <!-- Best Streak -->
    <div style="text-align: center;">
      <div
        style="
          font-weight: 700;
          font-size: 56px;
          color: #d4a140;
          margin-bottom: 8px;
        "
      >
        {stats.bestStreak}
      </div>
      <div style="font-weight: 400; font-size: 16px; color: #8a8aa4;">
        Best Streak
      </div>
    </div>
  </div>

  <!-- Bottom section: times and sparkline -->
  <div
    style="
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding: 20px 32px;
      height: 130px;
      gap: 32px;
    "
  >
    <!-- Times -->
    <div style="display: flex; gap: 24px; align-items: baseline;">
      <div>
        <span style="color: #8a8aa4; font-size: 14px;">Best</span>
        <span
          style="
            color: #d4a140;
            font-weight: 700;
            font-size: 16px;
            margin-left: 8px;
          "
        >
          {stats.bestTime !== null ? fmtMs(stats.bestTime) : "—"}
        </span>
      </div>
      <div>
        <span style="color: #8a8aa4; font-size: 14px;">Avg</span>
        <span
          style="
            color: #d4a140;
            font-weight: 700;
            font-size: 16px;
            margin-left: 8px;
          "
        >
          {stats.averageTime !== null ? fmtMs(stats.averageTime) : "—"}
        </span>
      </div>
    </div>

    <!-- Sparkline -->
    {#if stats.recentSolves.length >= 2 && sparklinePoints}
      <div style="flex: 1; display: flex; justify-content: flex-end;">
        <svg
          width="300"
          height="60"
          viewBox="0 0 300 60"
          style="overflow: visible;"
        >
          <polyline
            points={sparklinePoints}
            fill="none"
            stroke="#7dd4e8"
            stroke-width="2"
            vector-effect="non-scaling-stroke"
          />
        </svg>
      </div>
    {/if}
  </div>

  <!-- Footer -->
  <div
    style="
      display: flex;
      justify-content: center;
      align-items: center;
      height: 48px;
      border-top: 1px solid #2a2a3e;
      font-weight: 400;
      color: #8a8aa4;
      font-size: 14px;
    "
  >
    playunquote.com
  </div>
</div>

<style>
  /* Scoped styles if needed */
</style>
