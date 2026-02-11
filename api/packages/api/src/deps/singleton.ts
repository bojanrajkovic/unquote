import { createContainer, asValue, asFunction, type AwilixContainer } from "awilix";
import type { Logger } from "pino";
import type { QuoteSource, GameGenerator, KeywordSource } from "@unquote/game-generator";
import { KeywordCipherGenerator } from "@unquote/game-generator";
import type { AppConfig } from "../config/index.js";
import { JsonQuoteSource, StaticKeywordSource } from "../sources/index.js";

/**
 * Singleton cradle containing application-lifetime dependencies.
 * These are created once at startup and shared across all requests.
 */
export type AppSingletonCradle = {
  config: AppConfig;
  logger: Logger;
  quoteSource: QuoteSource;
  keywordSource: KeywordSource;
  gameGenerator: GameGenerator;
};

/**
 * Configure the singleton DI container with all application dependencies.
 *
 * @param config - Validated application configuration
 * @param logger - Pino logger instance from Fastify
 * @returns Configured Awilix container with typed cradle
 */
export async function configureContainer(
  config: AppConfig,
  logger: Logger,
): Promise<AwilixContainer<AppSingletonCradle>> {
  const container = createContainer<AppSingletonCradle>({
    strict: true,
  });

  // Construct and eagerly validate quotes file (fail-fast at startup)
  const quoteSource = new JsonQuoteSource(config.QUOTES_FILE_PATH);
  await quoteSource.ensureLoaded();

  // Static keyword source wraps the hardcoded KEYWORDS constant
  const keywordSource = new StaticKeywordSource();

  container.register({
    // Configuration and logger as values (already instantiated)
    config: asValue(config),
    logger: asValue(logger),

    // QuoteSource loads quotes from the configured file path
    quoteSource: asValue(quoteSource),

    // KeywordSource provides cipher keywords
    keywordSource: asValue(keywordSource),

    // GameGenerator depends on QuoteSource and KeywordSource
    gameGenerator: asFunction(
      (cradle: AppSingletonCradle) => new KeywordCipherGenerator(cradle.quoteSource, cradle.keywordSource),
    ).singleton(),
  });

  return container;
}
