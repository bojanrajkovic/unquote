/**
 * Player identity state — claim code and onboarding status.
 *
 * Hydrated from localStorage on first browser load.
 * All writes are immediately persisted.
 *
 * Use the exported `identity` singleton in components and load functions.
 */

import { browser } from "$app/environment";
import {
  STORAGE_KEYS,
  storageGet,
  storageSet,
  storageRemove,
} from "../storage";

class IdentityState {
  /** The player's claim code, or null if anonymous / not yet registered. */
  claimCode = $state<string | null>(null);

  /**
   * True once any onboarding path completes:
   * - Registration (claim code set)
   * - Skip (played anonymous)
   * - Existing code entered
   */
  hasOnboarded = $state(false);

  constructor() {
    if (!browser) return;

    // Hydrate from localStorage
    const storedCode = storageGet(STORAGE_KEYS.CLAIM_CODE);
    if (storedCode) this.claimCode = storedCode;

    const storedOnboarded = storageGet(STORAGE_KEYS.HAS_ONBOARDED);
    if (storedOnboarded === "true") this.hasOnboarded = true;
  }

  /**
   * Called after successful registration or entering an existing code.
   * Persists the claim code to localStorage.
   */
  setClaimCode(code: string): void {
    this.claimCode = code;
    this.hasOnboarded = true;
    if (browser) {
      storageSet(STORAGE_KEYS.CLAIM_CODE, code);
      storageSet(STORAGE_KEYS.HAS_ONBOARDED, "true");
    }
  }

  /**
   * Called when the player chooses "Skip" — play anonymously.
   * Does not set a claim code.
   */
  setSkipped(): void {
    this.hasOnboarded = true;
    if (browser) {
      storageSet(STORAGE_KEYS.HAS_ONBOARDED, "true");
    }
  }

  /**
   * Clear all identity state (e.g., for testing or "switch player").
   * Removes all identity keys from localStorage.
   */
  clear(): void {
    this.claimCode = null;
    this.hasOnboarded = false;
    if (browser) {
      storageRemove(STORAGE_KEYS.CLAIM_CODE);
      storageRemove(STORAGE_KEYS.HAS_ONBOARDED);
    }
  }
}

export const identity = new IdentityState();
