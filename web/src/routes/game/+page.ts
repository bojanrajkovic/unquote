import { browser } from "$app/environment";
import { redirect } from "@sveltejs/kit";
import { identity } from "$lib/state/identity.svelte.js";
import { game } from "$lib/state/game.svelte.js";
import type { StoredPuzzleState } from "$lib/state/game.svelte.js";
import { getToday } from "$lib/api.js";
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
    // Fetch today's puzzle from the API.
    const puzzle = await getToday();

    // Read stored state for today — discard if date doesn't match.
    const raw = storageGetJson<StoredPuzzleState>(STORAGE_KEYS.PUZZLE);
    const stored = raw?.date === puzzle.date ? raw : null;

    // Load puzzle into game state (resumes from stored or starts fresh).
    game.load(puzzle, stored);
  } catch {
    // Show in-page error rather than SvelteKit's error page (AC4.7).
    game.status = "error";
    game.errorMessage =
      "Could not load today's puzzle. Check your connection and try again.";
  }

  return {};
}
