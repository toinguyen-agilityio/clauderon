import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
export type DbHandle = { db: Db; close: () => Promise<void> };

export function connect(url: string): DbHandle {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  return { db: drizzle(pool, { schema }), close: () => pool.end() };
}
