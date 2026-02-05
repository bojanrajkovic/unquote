import { createContainer, asValue, asFunction, type AwilixContainer } from "awilix";
import type { Logger } from "pino";
import type { QuoteSource, GameGenerator } from "@unquote/game-generator";
import { JsonQuoteSource, KeywordCipherGenerator } from "@unquote/game-generator";
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
export function configureContainer(config: AppConfig, logger: Logger): AwilixContainer<AppSingletonCradle> {
  const container = createContainer<AppSingletonCradle>({
    strict: true,
  });

  container.register({
    // Configuration and logger as values (already instantiated)
    config: asValue(config),
    logger: asValue(logger),

    // QuoteSource loads quotes from the configured file path
    quoteSource: asValue(new JsonQuoteSource(config.QUOTES_FILE_PATH)),

    // GameGenerator depends on QuoteSource
    gameGenerator: asFunction(
      (cradle: AppSingletonCradle) => new KeywordCipherGenerator(cradle.quoteSource),
    ).singleton(),
  });

  return container;
}
