import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateFlow } from "@clauderon/core";
import { eq } from "drizzle-orm";
import { deleteFlow, deleteNode, listFlows, loadFlow, loadLibrary, schema, seedSamples, updateNode, type Db } from "../src/index";
import { createTestDatabase, type TestDatabase } from "../src/test-database";

let test: TestDatabase;
let db: Db;

beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
});
afterAll(() => test.drop());

describe("seedSamples", () => {
  it("inserts the nine sample Nodes and two sample Flows, flagged as samples", async () => {
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

  it("is idempotent: seeding again adds nothing", async () => {
    await seedSamples(db);
    await seedSamples(db);
    expect(await db.select().from(schema.node)).toHaveLength(9);
    expect(await db.select().from(schema.flow)).toHaveLength(2);
    expect(await db.select().from(schema.flowNode)).toHaveLength(12);
    expect(await db.select().from(schema.flowEdge)).toHaveLength(15);
  });

  it("FLW-8: seeding again keeps a Member's edits to samples and brings back a deleted sample", async () => {
    await seedSamples(db);
    const [draft] = await db.select().from(schema.node).where(eq(schema.node.slug, "draft-a-plan"));
    const changed = await updateNode(db, draft!.id, { name: "Draft a plan v2", kind: "agent", instructions: "Mine", command: null, inputs: draft!.inputs as never, outputs: draft!.outputs as never }, "ann@example.com", new Date());
    expect(changed).toMatchObject({ ok: true });
    const [basic, plan] = await listFlows(db);
    await db.update(schema.flow).set({ name: "Renamed" }).where(eq(schema.flow.id, plan!.id));
    expect(await deleteFlow(db, basic!.id)).toMatchObject({ ok: true });

    await seedSamples(db);
    const [kept] = await db.select().from(schema.node).where(eq(schema.node.slug, "draft-a-plan"));
    expect(kept).toMatchObject({ name: "Draft a plan v2", instructions: "Mine", updatedByEmail: "ann@example.com" });
    expect((await listFlows(db)).map((f) => f.name).sort()).toEqual(["Basic ticket delivery", "Renamed"]);
    expect(await db.select().from(schema.flowNode)).toHaveLength(12);

    // A deleted, unused sample Node comes back too.
    expect(await deleteNode(db, kept!.id)).toMatchObject({ ok: true });
    await seedSamples(db);
    expect(await db.select().from(schema.node).where(eq(schema.node.slug, "draft-a-plan"))).toHaveLength(1);
  });
});
