import { redirect } from "@sveltejs/kit";
import { identity } from "$lib/state/identity.svelte.js";

export const ssr = false;

export function load() {
  if (identity.hasOnboarded) {
    throw redirect(302, "/game");
  }
}
