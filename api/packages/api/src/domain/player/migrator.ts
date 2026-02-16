import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ADVISORY_LOCK_ID = 42;

/**
 * Resolve the migrations folder path.
 * Migration SQL files live in db/migrations/ at the package root (not in dist/).
 * From dist/domain/player/migrator.js, we go up 3 levels to reach the package root.
 */
function getMigrationsFolder(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return join(currentDir, "../../../db/migrations");
}

/**
 * Run database migrations with an advisory lock to prevent races
 * across concurrent API replicas.
 *
 * The advisory lock (ID 42) is session-scoped: it auto-releases if the
 * connection drops or the process crashes. Only one replica runs
 * migrations at a time; others block until the lock is released.
 */
export async function runMigrationsWithLock(db: NodePgDatabase): Promise<void> {
  await db.execute(sql`SELECT pg_advisory_lock(${sql.raw(String(ADVISORY_LOCK_ID))})`);
  try {
    await migrate(db, { migrationsFolder: getMigrationsFolder() });
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(${sql.raw(String(ADVISORY_LOCK_ID))})`);
  }
}

/**
 * CLI entrypoint for running migrations independently.
 * Used by Kubernetes init containers: `node dist/index.js migrate`
 *
 * Reads DATABASE_URL from the environment, runs migrations, and exits.
 * Exits with code 1 if DATABASE_URL is not set or migrations fail.
 */
export async function runMigrateCli(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    console.error("DATABASE_URL is required for migration");
    process.exit(1);
  }

  const { default: pg } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");

  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const db = drizzle({ client: pool });
    await runMigrationsWithLock(db);
    console.log("migrations completed successfully");
  } finally {
    await pool.end();
  }
}
