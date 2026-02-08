import { createContainer, asValue, type AwilixContainer } from "awilix";
import pino, { type Logger } from "pino";
import type { QuoteSource, GameGenerator, Quote, Puzzle } from "@unquote/game-generator";
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
  OTEL_EXPORTER_OTLP_ENDPOINT: undefined,
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

  return {
    getQuote: async (id: string): Promise<Quote | null> => {
      return id === testQuote.id ? testQuote : null;
    },
    getRandomQuote: async (): Promise<Quote> => {
      return testQuote;
    },
  };
}

/**
 * Create a mock GameGenerator for tests.
 * Note: The mock returns fixed/predictable data regardless of input.
 * The encryptedText and cipherMapping are example ROT13 values for
 * testing structure, not actual encryption of the input quote.
 */
export function createMockGameGenerator(): GameGenerator {
  return {
    generatePuzzle: (quote: Quote): Puzzle => {
      // Returns fixed mock data - encryptedText does not match quote.text
      return {
        id: "test-puzzle-1",
        encryptedText: "GUR DHVPX OEBJA SBK WHZCF BIRE GUR YNML QBT",
        originalQuote: quote,
        cipherMapping: {
          A: "N",
          B: "O",
          C: "P",
          D: "Q",
          E: "R",
          F: "S",
          G: "T",
          H: "U",
          I: "V",
          J: "W",
          K: "X",
          L: "Y",
          M: "Z",
          N: "A",
          O: "B",
          P: "C",
          Q: "D",
          R: "E",
          S: "F",
          T: "G",
          U: "H",
          V: "I",
          W: "J",
          X: "K",
          Y: "L",
          Z: "M",
        },
        hints: [],
        difficulty: quote.difficulty,
        generatedAt: new Date().toISOString(),
      };
    },
    generateDailyPuzzle: async (): Promise<Puzzle> => {
      const quote: Quote = {
        id: "daily-quote",
        text: "Test daily puzzle",
        author: "Daily Author",
        category: "daily",
        difficulty: 60,
      };
      return {
        id: "daily-puzzle-1",
        encryptedText: "GRFG QNVYL CHMMYR",
        originalQuote: quote,
        cipherMapping: {
          A: "N",
          B: "O",
          C: "P",
          D: "Q",
          E: "R",
          F: "S",
          G: "T",
          H: "U",
          I: "V",
          J: "W",
          K: "X",
          L: "Y",
          M: "Z",
          N: "A",
          O: "B",
          P: "C",
          Q: "D",
          R: "E",
          S: "F",
          T: "G",
          U: "H",
          V: "I",
          W: "J",
          X: "K",
          Y: "L",
          Z: "M",
        },
        hints: [],
        difficulty: 60,
        generatedAt: new Date().toISOString(),
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
