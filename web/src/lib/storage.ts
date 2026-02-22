/**
 * Typed localStorage abstraction.
 *
 * All keys the app writes to localStorage are declared here.
 * Use the typed get/set/remove functions — never call localStorage directly.
 */

export const STORAGE_KEYS = {
  /** Raw claim code string, e.g. "BRAVE-LION-1234". Null if anonymous. */
  CLAIM_CODE: "unquote_claim_code",
  /** JSON-serialized StoredPuzzleState with date discriminator. */
  PUZZLE: "unquote_puzzle",
  /** Boolean flag ("true") — set when any onboarding path completes. */
  HAS_ONBOARDED: "unquote_has_onboarded",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/** Retrieve a raw string value from localStorage. Returns null if missing. */
export function storageGet(key: StorageKey): string | null {
  return localStorage.getItem(key);
}

/** Write a raw string value to localStorage. */
export function storageSet(key: StorageKey, value: string): void {
  localStorage.setItem(key, value);
}

/** Remove a key from localStorage. */
export function storageRemove(key: StorageKey): void {
  localStorage.removeItem(key);
}

/** Parse a stored JSON value. Returns null if key is missing or JSON is invalid. */
export function storageGetJson<T>(key: StorageKey): T | null {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Serialize and write a value as JSON to localStorage. */
export function storageSetJson<T>(key: StorageKey, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}
