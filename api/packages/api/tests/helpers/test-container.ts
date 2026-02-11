import { createContainer, asValue, type AwilixContainer } from "awilix";
import pino, { type Logger } from "pino";
import { QuoteSource, type GameGenerator, type Quote, type Puzzle } from "@unquote/game-generator";
import type { AppConfig } from "../../src/config/index.js";
import type { AppSingletonCradle } from "../../src/deps/index.js";

/**
 * Default test configuration.
 */
export const defaultTestConfig: AppConfig = {
  PORT: 3000,
  HOST: "0.0.0.0",
  LOG_LEVEL: "silent",
  QUOTES_FILE_PATH: "/tmp/test-quotes.json",
  CORS_ORIGIN: "*",
  TRUST_PROXY: false,
  RATE_LIMIT_MAX: 100,
  RATE_LIMIT_WINDOW: "1 minute",
};

/**
 * Create a silent Pino logger for tests.
 * Suppresses all log output to keep test output clean.
 */
export function createSilentLogger(): Logger {
  return pino({ level: "silent" });
}

/**
 * Minimal QuoteSource subclass for tests.
 * Returns a fixed array of quotes — getQuote() and getRandomQuote()
 * are inherited from the abstract class.
 */
export class TestQuoteSource extends QuoteSource {
  constructor(private readonly quotes: readonly Quote[]) {
    super();
  }

  async getAllQuotes(): Promise<Quote[]> {
    return [...this.quotes];
  }
}

/**
 * Create a mock QuoteSource for tests.
 */
export function createMockQuoteSource(): QuoteSource {
  const testQuote: Quote = {
    id: "test-quote-1",
    text: "The quick brown fox jumps over the lazy dog",
    author: "Test Author",
    category: "test",
    difficulty: 50,
  };

  return new TestQuoteSource([testQuote]);
}

/**
 * ROT13 cipher mapping used in mock puzzles.
 */
const rot13Mapping = {
  a: "N",
  b: "O",
  c: "P",
  d: "Q",
  e: "R",
  f: "S",
  g: "T",
  h: "U",
  i: "V",
  j: "W",
  k: "X",
  l: "Y",
  m: "Z",
  n: "A",
  o: "B",
  p: "C",
  q: "D",
  r: "E",
  s: "F",
  t: "G",
  u: "H",
  v: "I",
  w: "J",
  x: "K",
  y: "L",
  z: "M",
} as const;

/**
 * Create a mock GameGenerator for tests.
 * Note: The mock returns fixed/predictable data regardless of input.
 * The encryptedText and mapping are example ROT13 values for
 * testing structure, not actual encryption of the input quote.
 */
export function createMockGameGenerator(): GameGenerator {
  return {
    generatePuzzle: (quote: Quote): Puzzle => {
      return {
        quoteId: quote.id,
        encryptedText: "GUR DHVPX OEBJA SBK WHZCF BIRE GUR YNML QBT",
        mapping: rot13Mapping,
        hints: [],
      };
    },
    generateDailyPuzzle: async (): Promise<Puzzle> => {
      return {
        quoteId: "daily-quote",
        encryptedText: "GRFG QNVYL CHMMYR",
        mapping: rot13Mapping,
        hints: [],
      };
    },
  };
}

/**
 * Options for creating a test container with partial overrides.
 */
export type TestContainerOptions = {
  config?: Partial<AppConfig>;
  logger?: Logger;
  quoteSource?: QuoteSource;
  gameGenerator?: GameGenerator;
};

/**
 * Create a test container with mock defaults.
 * Pass overrides to customize specific dependencies for a test.
 *
 * @example
 * // Use all defaults
 * const container = createTestContainer();
 *
 * @example
 * // Override specific dependency
 * const container = createTestContainer({
 *   quoteSource: myCustomMockQuoteSource,
 * });
 */
export function createTestContainer(options: TestContainerOptions = {}): AwilixContainer<AppSingletonCradle> {
  const container = createContainer<AppSingletonCradle>({
    strict: true,
  });

  const config: AppConfig = {
    ...defaultTestConfig,
    ...options.config,
  };

  const logger = options.logger ?? createSilentLogger();
  const quoteSource = options.quoteSource ?? createMockQuoteSource();

  container.register({
    config: asValue(config),
    logger: asValue(logger),
    quoteSource: asValue(quoteSource),
    gameGenerator: asValue(options.gameGenerator ?? createMockGameGenerator()),
  });

  return container;
}
