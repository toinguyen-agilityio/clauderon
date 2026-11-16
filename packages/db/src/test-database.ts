import { randomUUID } from "node:crypto";
import pg from "pg";
import { connect, type Db } from "./client";
import { migrate } from "./migrate";

export type TestDatabase = { db: Db; url: string; drop: () => Promise<void> };

/**
 * A fresh, migrated database for one test file (spec "test seam"): real
 * Postgres, no mocks. Needs TEST_DATABASE_URL pointing at a server where the
 * user may create databases.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const serverUrl = process.env.TEST_DATABASE_URL ?? "postgres://clauderon:clauderon@localhost:54329/clauderon";
  const name = `clauderon_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Client({ connectionString: serverUrl });
  await admin.connect();
  await admin.query(`create database "${name}"`);
  await admin.end();

  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  const handle = connect(url.toString());
  await migrate(handle.db);

  return {
    db: handle.db,
    url: url.toString(),
    drop: async () => {
      await handle.close();
      const cleanup = new pg.Client({ connectionString: serverUrl });
      await cleanup.connect();
      await cleanup.query(`drop database if exists "${name}" with (force)`);
      await cleanup.end();
    },
  };
}
