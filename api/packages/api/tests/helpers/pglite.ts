import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(currentDir, "../../db/migrations");

/**
 * Snapshot of a PGlite database after migrations, for test isolation.
 */
export type PGliteSnapshot = Blob | File;

/**
 * Create a PGlite instance with migrations applied, then take a snapshot.
 * Call once in beforeAll. The returned snapshot can be restored per test.
 */
export async function createMigratedSnapshot(): Promise<PGliteSnapshot> {
  const client = new PGlite();
  const db = drizzle({ client });
  await migrate(db, { migrationsFolder });
  const snapshot = await client.dumpDataDir("none");
  await client.close();
  return snapshot;
}

/**
 * Restore a PGlite instance from a snapshot.
 * Call in beforeEach to get a clean database per test.
 */
export async function restoreSnapshot(snapshot: PGliteSnapshot): Promise<PGlite> {
  return PGlite.create({ loadDataDir: snapshot });
}
