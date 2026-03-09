<script lang="ts">
  import { fmtMs } from "./format.js";

  export interface Props {
    puzzleNumber: string;
    solved: boolean;
    completionTime: number | null;
    letterGrid: string;
    currentStreak: number | null;
  }

  const {
    puzzleNumber,
    solved,
    completionTime,
    letterGrid,
    currentStreak,
  }: Props = $props();

  const gridRows = $derived(letterGrid.split("\n"));
</script>

<div
  data-testid="session-card"
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
      >{puzzleNumber}</span
    >
  </div>

  <!-- Center content -->
  <div
    style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      padding: 20px 32px;
    "
  >
    <div
      style="
        font-family: 'Cormorant Garamond', serif;
        font-weight: 600;
        font-size: 64px;
        color: #d4a140;
        margin-bottom: 16px;
      "
    >
      {solved ? "SOLVED" : "UNSOLVED"}
    </div>
    {#if solved && completionTime !== null}
      <div
        style="
          font-family: 'Space Mono', monospace;
          font-weight: 700;
          font-size: 72px;
          color: #d4a140;
        "
      >
        {fmtMs(completionTime)}
      </div>
    {/if}
  </div>

  <!-- Bottom section with grid and streak -->
  <div
    style="
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding: 20px 32px;
      height: 140px;
      gap: 32px;
    "
  >
    <!-- Letter grid -->
    <div style="flex: 1;">
      {#each gridRows as row}
        <div style="font-size: 16px; line-height: 1.5; letter-spacing: 4px;">
          {row}
        </div>
      {/each}
    </div>

    <!-- Streak badge -->
    {#if currentStreak !== null && currentStreak > 0}
      <div
        style="
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 20px;
          color: #d4a140;
          font-weight: 700;
        "
      >
        <span>🔥</span>
        <span>{currentStreak}</span>
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
