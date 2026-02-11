import { createContainer, asValue, asFunction, type AwilixContainer } from "awilix";
import type { Logger } from "pino";
import type { QuoteSource, GameGenerator } from "@unquote/game-generator";
import { KeywordCipherGenerator } from "@unquote/game-generator";
import { JsonQuoteSource } from "../sources/index.js";
import type { AppConfig } from "../config/index.js";

/**
 * Singleton cradle containing application-lifetime dependencies.
 * These are created once at startup and shared across all requests.
 */
export type AppSingletonCradle = {
  config: AppConfig;
  logger: Logger;
  quoteSource: QuoteSource;
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

  container.register({
    // Configuration and logger as values (already instantiated)
    config: asValue(config),
    logger: asValue(logger),

    // QuoteSource loads quotes from the configured file path
    quoteSource: asValue(quoteSource),

    // GameGenerator depends on QuoteSource
    gameGenerator: asFunction(
      (cradle: AppSingletonCradle) => new KeywordCipherGenerator(cradle.quoteSource),
    ).singleton(),
  });

  return container;
}
