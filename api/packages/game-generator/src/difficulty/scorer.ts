import { COMMON_DIGRAMS } from "./letter-data.js";

// Weights for each factor (v2 algorithm)
const WEIGHT_LENGTH_DIVERSITY = 0.15;
const WEIGHT_SHORT_WORDS = 0.15;
const WEIGHT_LETTER_DOMINANCE = 0.15;
const WEIGHT_PATTERN_UNIQUENESS = 0.15;
const WEIGHT_WORD_REPETITION = 0.15;
const WEIGHT_ALPHABET_COVERAGE = 0.1;
const WEIGHT_DIGRAM = 0.15;

/**
 * Extract only letters from text (lowercase).
 */
function extractLetters(text: string): string {
  return text.toLowerCase().replaceAll(/[^a-z]/g, "");
}

/**
 * Split text into words (letters only).
 */
function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replaceAll(/[^a-z]/g, ""))
    .filter((word) => word.length > 0);
}

/**
 * Calculate length + diversity factor (0-100).
 * Longer texts with more unique letters = higher difficulty.
 * Hybrid approach: 80% length contribution + up to 20 point diversity bonus.
 */
function calculateLengthDiversityFactor(letters: string): number {
  const { length } = letters;
  const uniqueLetters = new Set(letters).size;

  // Base: 80% of length (capped at 100)
  const lengthBase = Math.min(100, length);

  // Bonus: up to 20 points for alphabet coverage (26 unique = +20)
  const diversityBonus = (uniqueLetters / 26) * 20;

  return Math.min(100, Math.round(lengthBase * 0.8 + diversityBonus));
}

/**
 * Calculate short word scarcity factor (0-100).
 * Fewer helpful short words = higher difficulty.
 *
 * Weighted scoring:
 * - 1-2 letter words (a, I, an, is, to): 1.0 weight (most helpful)
 * - 3 letter words (the, and, can): 0.6 weight (moderately helpful)
 * - 4 letter words (that, have, with): 0.2 weight (slightly helpful)
 */
function calculateShortWordScarcityFactor(words: readonly string[]): number {
  if (words.length === 0) {return 50;}

  let helpfulWordScore = 0;
  for (const word of words) {
    if (word.length <= 2) {helpfulWordScore += 1.0;}
    else if (word.length === 3) {helpfulWordScore += 0.6;}
    else if (word.length === 4) {helpfulWordScore += 0.2;}
  }

  const ratio = helpfulWordScore / words.length;

  // High ratio (many helpful words) = low score (easier)
  // Low ratio (few helpful words) = high score (harder)
  return Math.round((1 - ratio) * 100);
}

/**
 * Calculate letter dominance penalty factor (0-100).
 * When a single letter dominates the text, it's easier to identify.
 * Penalty applied when any letter exceeds 12% of text.
 */
export function calculateLetterDominanceFactor(letters: string): number {
  if (letters.length === 0) {return 50;}

  const counts: Record<string, number> = {};
  for (const char of letters) {
    counts[char] = (counts[char] ?? 0) + 1;
  }

  const maxCount = Math.max(...Object.values(counts));
  const maxFreq = maxCount / letters.length;

  // Threshold: 12% is typical for common letters like E, T, A
  // Above that, apply increasing penalty (lower score = easier)
  const threshold = 0.12;

  if (maxFreq <= threshold) {
    return 100; // No dominant letter = harder
  }

  // Steeper curve using square root for aggressive penalty at start
  // At 12% = 100, at ~25% = ~50, at ~40% = ~10
  const excessRatio = (maxFreq - threshold) / (0.5 - threshold);
  const penaltyFactor = Math.min(1, excessRatio) ** 0.5;
  return Math.max(0, Math.round((1 - penaltyFactor) * 100));
}

/**
 * Calculate pattern uniqueness factor (0-100).
 * Fewer repeated word patterns = higher difficulty.
 * Uses cubic scaling for aggressive repetition penalty.
 */
export function calculatePatternUniquenessFactor(words: string[]): number {
  if (words.length <= 1) {return 50;}

  const uniqueWords = new Set(words).size;
  const ratio = uniqueWords / words.length;

  // Cube the ratio: 100% unique = 100, 50% unique = 12.5, 33% unique = 3.7
  return Math.round(ratio ** 3 * 100);
}

/**
 * Calculate word repetition penalty factor (0-100).
 * Direct penalty when words appear multiple times.
 * - Each occurrence beyond first: -10 points
 * - Bonus penalty for 3+ occurrences: -20 points per word
 */
export function calculateWordRepetitionFactor(words: string[]): number {
  if (words.length === 0) {return 50;}

  const counts: Record<string, number> = {};
  for (const word of words) {
    counts[word] = (counts[word] ?? 0) + 1;
  }

  let penalty = 0;
  for (const count of Object.values(counts)) {
    if (count >= 2) {
      // -10 for each occurrence beyond the first
      penalty += (count - 1) * 10;

      // Bonus penalty if word appears 3+ times
      if (count >= 3) {
        penalty += 20;
      }
    }
  }

  return Math.max(0, 100 - penalty);
}

/**
 * Calculate alphabet coverage factor (0-100).
 * Fewer unique letters = easier (more patterns to exploit).
 * Scale: 5 or fewer unique = 0, 20+ unique = 100
 */
export function calculateAlphabetCoverageFactor(letters: string): number {
  if (letters.length === 0) {return 50;}

  const uniqueLetters = new Set(letters).size;

  // Expect ~12-15 unique letters in a typical quote
  // <5 unique = very easy, >20 unique = harder
  if (uniqueLetters <= 5) {return 0;}
  if (uniqueLetters >= 20) {return 100;}

  // Linear scale from 5-20
  return Math.round(((uniqueLetters - 5) / 15) * 100);
}

/**
 * Calculate digram frequency factor (0-100).
 * Fewer common letter pairs = higher difficulty.
 */
function calculateDigramFactor(letters: string): number {
  if (letters.length < 2) {return 50;}

  const upperLetters = letters.toUpperCase();

  // Count common digrams
  let commonDigramCount = 0;
  for (let i = 0; i < upperLetters.length - 1; i++) {
    const digram = upperLetters.slice(i, i + 2);
    if (COMMON_DIGRAMS.includes(digram)) {
      commonDigramCount++;
    }
  }

  // Higher ratio of common digrams = easier (lower score)
  const totalDigrams = letters.length - 1;
  const ratio = commonDigramCount / totalDigrams;

  // Invert: more common digrams = lower difficulty
  return Math.round((1 - ratio) * 100);
}

/**
 * Calculate difficulty score for a text (0-100).
 *
 * v2 Algorithm with 7 factors:
 * - Length + diversity (15%): Longer texts with more unique letters are harder
 * - Short word scarcity (15%): Fewer helpful words (1-4 letters) = harder
 * - Letter dominance (15%): Dominant letters make puzzles easier
 * - Pattern uniqueness (15%): Repeated words make puzzles easier (cubic scaling)
 * - Word repetition (15%): Direct penalty for repeated words
 * - Alphabet coverage (10%): Fewer unique letters = easier
 * - Digram frequency (15%): Common letter pairs aid solving
 */
export function scoreDifficulty(text: string): number {
  const letters = extractLetters(text);
  const words = extractWords(text);

  const lengthDiversityScore = calculateLengthDiversityFactor(letters);
  const shortWordScore = calculateShortWordScarcityFactor(words);
  const letterDominanceScore = calculateLetterDominanceFactor(letters);
  const patternScore = calculatePatternUniquenessFactor(words);
  const wordRepetitionScore = calculateWordRepetitionFactor(words);
  const alphabetCoverageScore = calculateAlphabetCoverageFactor(letters);
  const digramScore = calculateDigramFactor(letters);

  const weightedScore =
    lengthDiversityScore * WEIGHT_LENGTH_DIVERSITY +
    shortWordScore * WEIGHT_SHORT_WORDS +
    letterDominanceScore * WEIGHT_LETTER_DOMINANCE +
    patternScore * WEIGHT_PATTERN_UNIQUENESS +
    wordRepetitionScore * WEIGHT_WORD_REPETITION +
    alphabetCoverageScore * WEIGHT_ALPHABET_COVERAGE +
    digramScore * WEIGHT_DIGRAM;

  return Math.round(weightedScore);
}
