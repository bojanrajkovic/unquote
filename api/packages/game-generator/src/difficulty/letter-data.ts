/**
 * English letter frequencies (percentage of total letters in typical text).
 * Source: Standard English letter frequency data.
 */
export const LETTER_FREQUENCY: Record<string, number> = {
  e: 12.7,
  t: 9.1,
  a: 8.2,
  o: 7.5,
  i: 7,
  n: 6.7,
  s: 6.3,
  h: 6.1,
  r: 6,
  d: 4.3,
  l: 4,
  c: 2.8,
  u: 2.8,
  m: 2.4,
  w: 2.4,
  f: 2.2,
  g: 2,
  y: 2,
  p: 1.9,
  b: 1.5,
  v: 1,
  k: 0.8,
  j: 0.15,
  x: 0.15,
  q: 0.1,
  z: 0.07,
};

/**
 * Common English digrams (letter pairs) with relative frequency.
 * Higher values = more common pairs that help solvers.
 */
export const COMMON_DIGRAMS: readonly string[] = [
  "TH",
  "HE",
  "IN",
  "ER",
  "AN",
  "RE",
  "ON",
  "AT",
  "EN",
  "ND",
  "TI",
  "ES",
  "OR",
  "TE",
  "OF",
  "ED",
  "IS",
  "IT",
  "AL",
  "AR",
];
