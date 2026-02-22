import { browser } from "$app/environment";
import { redirect } from "@sveltejs/kit";
import { identity } from "$lib/state/identity.svelte.js";
import { game } from "$lib/state/game.svelte.js";
import type { StoredPuzzleState } from "$lib/state/game.svelte.js";
import { getToday } from "$lib/api.js";
import type { PuzzleResponse } from "$lib/api.js";
import { STORAGE_KEYS, storageGetJson } from "$lib/storage.js";

// Not prerendered — served by CloudFront 404.html fallback.
// The redirect guard and puzzle load both run client-side.
export const prerender = false;

export async function load() {
  // During SSR (adapter-static build scan), skip — browser APIs unavailable.
  if (!browser) return {};

  if (!identity.hasOnboarded) {
    throw redirect(302, "/");
  }

  try {
    // Get today's date for comparison.
    const today = new Date().toISOString().split("T")[0];

    // Check localStorage first for same-day reload.
    const raw = storageGetJson<StoredPuzzleState>(STORAGE_KEYS.PUZZLE);
    let puzzle: PuzzleResponse;

    if (raw?.date === today && raw.puzzle) {
      // Same-day reload — use stored puzzle data, avoiding API call.
      puzzle = {
        id: raw.puzzle.id,
        date: raw.date,
        encryptedText: raw.puzzle.encryptedText,
        hints: raw.puzzle.hints,
        author: raw.puzzle.author,
        category: raw.puzzle.category,
        difficulty: raw.puzzle.difficulty,
      };
    } else {
      // Stale or missing — fetch from API.
      puzzle = await getToday();
    }

    // Load puzzle into game state (resumes from stored or starts fresh).
    game.load(puzzle, raw?.date === puzzle.date ? raw : null);
  } catch {
    // Show in-page error rather than SvelteKit's error page (AC4.7).
    game.status = "error";
    game.errorMessage =
      "Could not load today's puzzle. Check your connection and try again.";
  }

  return {};
}
