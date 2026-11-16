import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateFlow } from "@clauderon/core";
import { listFlows, loadFlow, loadLibrary, schema, seedSamples, type Db } from "../src/index";
import { createTestDatabase, type TestDatabase } from "../src/test-database";

let test: TestDatabase;
let db: Db;

beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
});
afterAll(() => test.drop());

describe("seedSamples", () => {
  it("inserts the nine sample Nodes and two sample Flows, read-only", async () => {
    await seedSamples(db);
    const nodes = await db.select().from(schema.node);
    const flows = await listFlows(db);
    expect(nodes).toHaveLength(9);
    expect(flows.map((f) => f.name)).toEqual(["Basic ticket delivery", "Plan and deliver"]);
    expect([...nodes, ...flows].every((row) => row.isSample)).toBe(true);
  });

  it("T0-1: both seeded sample Flows pass validateFlow with no problems", async () => {
    await seedSamples(db);
    const library = await loadLibrary(db);
    for (const f of await listFlows(db)) {
      expect(validateFlow(await loadFlow(db, f.id), library)).toEqual([]);
    }
  });

  it("is idempotent: seeding again updates instead of duplicating", async () => {
    await seedSamples(db);
    await seedSamples(db);
    expect(await db.select().from(schema.node)).toHaveLength(9);
    expect(await db.select().from(schema.flow)).toHaveLength(2);
    expect(await db.select().from(schema.flowNode)).toHaveLength(12);
    expect(await db.select().from(schema.flowEdge)).toHaveLength(15);
  });
});
