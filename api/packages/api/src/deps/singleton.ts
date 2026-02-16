import { createContainer, asValue, asFunction, type AwilixContainer } from "awilix";
import type { Logger } from "pino";
import type { QuoteSource, GameGenerator, KeywordSource } from "@unquote/game-generator";
import { KeywordCipherGenerator } from "@unquote/game-generator";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { instrumentDrizzleClient } from "@kubiks/otel-drizzle";
import type { AppConfig } from "../config/index.js";
import { JsonQuoteSource } from "../sources/json-quote-source.js";
import { StaticKeywordSource } from "../sources/static-keyword-source.js";
import { tracedProxy } from "../tracing/traced-proxy.js";
import { runMigrationsWithLock } from "../domain/player/migrator.js";

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

type ContainerResult = {
  container: AwilixContainer<AppSingletonCradle>;
  shutdown: () => Promise<void>;
};

/**
 * Configure the singleton DI container with all application dependencies.
 *
 * @param config - Validated application configuration
 * @param logger - Pino logger instance from Fastify
 * @returns Configured Awilix container with typed cradle and shutdown callback
 */
export async function configureContainer(config: AppConfig, logger: Logger): Promise<ContainerResult> {
  const container = createContainer<AppSingletonCradle>({
    strict: true,
  });

  // Construct and eagerly validate quotes file (fail-fast at startup)
  const rawQuoteSource = new JsonQuoteSource(config.QUOTES_FILE_PATH);
  await rawQuoteSource.ensureLoaded();
  const quoteSource = tracedProxy<QuoteSource>(rawQuoteSource, "QuoteSource");

  // Static keyword source wraps the hardcoded KEYWORDS constant
  const keywordSource = tracedProxy<KeywordSource>(new StaticKeywordSource(), "KeywordSource");

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

  // Database setup — local to configureContainer, not registered in cradle
  let db: NodePgDatabase | null = null;
  let pool: Pool | null = null;

  if (config.DATABASE_URL) {
    pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: 5,
    });

    // Handle unexpected pool errors (e.g., idle client disconnects).
    // The `logger` reference here captures the container-level logger (not request-scoped),
    // which is correct since pool errors occur outside request context.
    pool.on("error", (err) => {
      logger.error({ err }, "unexpected error on idle database client");
    });

    db = drizzle({ client: pool });
    instrumentDrizzleClient(db);
    await runMigrationsWithLock(db);
    logger.info("database connected and migrations applied");
  }

  // No db registration — it's an implementation detail consumed only inside this function.
  // Phase 2 Task 6 will create PgPlayerStore(db) here and register playerStore in the cradle.
  return {
    container,
    shutdown: async () => {
      if (pool) {
        await pool.end();
      }
    },
  };
}
