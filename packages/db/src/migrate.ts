import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate as runMigrations } from "drizzle-orm/node-postgres/migrator";
import type { Db } from "./client";

// Kept out of the package entry so the web bundle never resolves the
// migrations folder; the migrate script and the test database use it.
export async function migrate(db: Db): Promise<void> {
  await runMigrations(db, { migrationsFolder: join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle") });
}
