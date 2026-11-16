import { fileURLToPath } from "node:url";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate as runMigrations } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "./schema.js";

export type Db = NodePgDatabase<typeof schema>;
export type DbHandle = { db: Db; close: () => Promise<void> };

export function connect(url: string): DbHandle {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  return { db: drizzle(pool, { schema }), close: () => pool.end() };
}

export const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

export async function migrate(db: Db): Promise<void> {
  await runMigrations(db, { migrationsFolder });
}
