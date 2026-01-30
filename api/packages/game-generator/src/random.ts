import { createHash } from "node:crypto";

/**
 * Hash a string to a 48-bit number using SHA-256.
 *
 * Uses SHA-256 (truncated) for excellent distribution properties.
 * SHA-256 is exhaustively analyzed and built into Node.js.
 * 48 bits fits safely in JavaScript's 53-bit safe integer range
 * while providing excellent distribution for large datasets (1000s of items).
 */
export function hashString(str: string): number {
  const hash = createHash("sha256").update(str).digest();
  // Read first 6 bytes as 48-bit big-endian number
  return hash.readUIntBE(0, 6);
}

/**
 * XorShift128+ PRNG - the algorithm used by V8 (Chrome) for Math.random().
 *
 * Well-analyzed by Vigna (2017), excellent statistical properties,
 * and battle-tested in billions of daily Math.random() calls.
 * Returns a function that generates values in [0, 1).
 *
 * State initialization uses SplitMix32 to expand the single seed
 * into 4 independent 32-bit state values.
 */
export function createSeededRng(seed: number): () => number {
  const s = new Uint32Array(4);

  // Initialize state from seed using SplitMix32
  // This ensures good state initialization even from poor seeds
  let z = seed >>> 0;
  if (z === 0) {z = 1;} // Avoid zero seed
  for (let i = 0; i < 4; i++) {
    z = Math.imul(z ^ (z >>> 16), 0x85_eb_ca_6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2_b2_ae_35) >>> 0;
    s[i] = z ^= z >>> 16;
  }

  return function (): number {
    // XorShift128+ algorithm
    let s1 = (s[0] ?? 0) | ((s[1] ?? 0) << 16);
    let s0 = (s[2] ?? 0) | ((s[3] ?? 0) << 16);

    // Store low state
    s[0] = s0 & 0xff_ff;
    s[1] = s0 >>> 16;

    // XorShift operations
    s1 ^= s1 << 23;
    s1 ^= s1 >>> 17;
    s1 ^= s0 ^ (s0 >>> 26);

    // Store high state
    s[2] = s1 & 0xff_ff;
    s[3] = s1 >>> 16;

    // Return normalized [0, 1) value
    return ((s0 + s1) >>> 0) / 4_294_967_296;
  };
}

/**
 * Select a random element from an array using seeded RNG.
 */
export function selectFromArray<T>(array: readonly T[], rng: () => number): T {
  if (array.length === 0) {
    throw new Error("Cannot select from empty array");
  }
  const index = Math.floor(rng() * array.length);
  const element = array[index];
  if (element === undefined) {
    throw new Error("Unexpected: index out of bounds");
  }
  return element;
}
