import { browser } from "$app/environment";
import { identity } from "$lib/state/identity.svelte.js";
import { getStats } from "$lib/api.js";
import type { PlayerStats } from "$lib/api.js";

export const prerender = false;

export interface StatsPageData {
  stats: PlayerStats | null;
  error: string | null;
}

export async function load(): Promise<StatsPageData> {
  if (!browser || !identity.claimCode) {
    // No claim code → anonymous user; do NOT call the API (AC4.6).
    return { stats: null, error: null };
  }

  try {
    const stats = await getStats(identity.claimCode);
    return { stats, error: null };
  } catch {
    return {
      stats: null,
      error: "Could not load your stats. Check your connection and try again.",
    };
  }
}
