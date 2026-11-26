import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { describeChange, type NodeDefinition } from "@clauderon/core";
import { eq, sql } from "drizzle-orm";
import {
  buildFlowSnapshot,
  cloneFlow,
  cloneFlowVersion,
  createFlow,
  createNode,
  deleteFlow,
  deleteNode,
  getFlowVersion,
  hashToken,
  importFlow,
  listDeletedFlows,
  listFlowHistory,
  loadFlowDetail,
  restoreFlowVersion,
  saveFlow,
  schema,
  startBatch,
  updateNode,
  type Db,
  type FlowGraphInput,
} from "../src/index";
import { createTestDatabase, type TestDatabase } from "../src/test-database";

const t = (n: number) => new Date(`2026-11-26T10:00:${String(n).padStart(2, "0")}Z`);
const ann = "ann@example.com";
const bob = "bob@example.com";

let test: TestDatabase;
let db: Db;
beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
});
afterAll(() => test.drop());
beforeEach(async () => {
  await db.execute(sql`truncate member, machine, project, batch, run, audit_entry, flow, node, flow_version cascade`);
});

const agent = (name: string, instructions = `do ${name}`): NodeDefinition => ({
  name,
  kind: "agent",
  instructions,
  command: null,
  inputs: [{ name: "in", type: "text", required: false }] as never,
  outputs: [{ name: "out", type: "text", optional: false }] as never,
});
const uuid = () => crypto.randomUUID();

/** A Flow of the Ticket Input plus the given library Nodes, in a chain; saved nowhere yet. */
async function flowWith(names: string[]) {
  await db
    .insert(schema.node)
    .values({ name: "Ticket", slug: "ticket", kind: "ticket", outputs: [{ name: "out", type: "text", optional: false }] as never, updatedByEmail: ann })
    .onConflictDoNothing();
  const created = await createFlow(db, "Ship", ann, t(0));
  const detail = (await loadFlowDetail(db, created.id))!;
  const libs: { id: string }[] = [];
  for (const n of names) libs.push(await createNode(db, agent(n), ann, t(0)));
  const placements = [
    ...detail.nodes,
    ...libs.map((l, i) => ({ id: uuid(), nodeId: l.id, label: null, extraInstructions: "", enabledOptionalOutputs: [] as string[], x: 100 * (i + 1), y: 0 })),
  ];
  const edges = placements.slice(1).map((p, i) => ({ id: uuid(), fromFlowNodeId: placements[i]!.id, fromOutput: "out", toFlowNodeId: p.id, toInput: "in" }));
  const graph: FlowGraphInput = { name: "Ship", nodes: placements, edges };
  return { flowId: created.id, graph, libs };
}

const history = (flowId: string) => listFlowHistory(db, flowId);

async function lockFlow(flowId: string) {
  const [member] = await db.insert(schema.member).values({ email: ann }).returning();
  const [machine] = await db.insert(schema.machine).values({ memberId: member!.id, tokenHash: hashToken("a") }).returning();
  const [project] = await db.insert(schema.project).values({ owner: "acme", repo: "web", baseBranch: "main", enabledByEmail: ann }).returning();
  const started = await startBatch(
    db,
    {
      flowId,
      flowSnapshot: (await buildFlowSnapshot(db, flowId))!,
      starter: { id: member!.id, email: ann },
      machineId: machine!.id,
      extraInstructions: "",
      ticketIds: [],
      direct: [{ projectId: project!.id, title: "T", input: { type: "plan", value: "x" } }],
    },
    t(30),
  );
  if (!started.ok) throw new Error("not started");
}

describe("recording", () => {
  it("create, clone and import each record one version with the right kind", async () => {
    const created = await createFlow(db, "A", ann, t(1));
    expect((await history(created.id)).map((v) => [v.seq, v.kind, v.actorEmail])).toEqual([[1, "create", ann]]);
    const copy = (await cloneFlow(db, created.id, bob, t(2)))!;
    const [clone] = await history(copy.id);
    expect(clone).toMatchObject({ seq: 1, kind: "clone", actorEmail: bob, detail: { clonedFrom: created.id } });
    expect(copy.versionId).toBe(clone!.id);
    const imported = await importFlow(db, { name: "I", nodes: [], placements: [], edges: [] }, bob, t(3));
    expect((await history(imported.id)).map((v) => v.kind)).toEqual(["import"]);
  });

  it("a save records an update with a summary in plain words, numbered in order, newest first", async () => {
    const { flowId, graph } = await flowWith(["Plan", "Implement"]);
    expect(await saveFlow(db, flowId, graph, ann, t(1))).toMatchObject({ ok: true, versionId: expect.any(String) });
    const plan = graph.nodes[1]!;
    const next: FlowGraphInput = { name: "Ship it", nodes: [{ ...plan, extraInstructions: "be brief" }], edges: [] };
    expect(await saveFlow(db, flowId, next, bob, t(2))).toMatchObject({ ok: true });
    const list = await history(flowId);
    expect(list.map((v) => [v.seq, v.kind])).toEqual([
      [3, "update"],
      [2, "update"],
      [1, "create"],
    ]);
    expect(list[0]!.summary.map(describeChange)).toEqual(
      expect.arrayContaining(['Flow renamed from "Ship" to "Ship it"', 'Node "Implement" removed', 'Extra instructions of "Plan" edited']),
    );
    expect(list[0]!.actorEmail).toBe(bob);
  });

  it("a save that changes nothing records nothing, and a locked or failed save records nothing", async () => {
    const { flowId, graph } = await flowWith(["Plan"]);
    await saveFlow(db, flowId, graph, ann, t(1));
    const before = (await history(flowId)).length;
    expect(await saveFlow(db, flowId, graph, ann, t(2))).toEqual({ ok: true, versionId: null });
    await lockFlow(flowId);
    expect(await saveFlow(db, flowId, { ...graph, name: "Other" }, ann, t(3))).toMatchObject({ ok: false, reason: "locked" });
    expect(await saveFlow(db, uuid(), graph, ann, t(3))).toMatchObject({ ok: false, reason: "not-found" });
    expect(await history(flowId)).toHaveLength(before);
  });

  it("a move alone is recorded as a layout change", async () => {
    const { flowId, graph } = await flowWith(["Plan"]);
    await saveFlow(db, flowId, graph, ann, t(1));
    await saveFlow(db, flowId, { ...graph, nodes: graph.nodes.map((n) => ({ ...n, x: n.x + 40 })) }, ann, t(2));
    expect((await history(flowId))[0]!.summary.map(describeChange)).toEqual(["Layout changed"]);
  });

  it("masks known token patterns in stored snapshots (NFR-1)", async () => {
    const { flowId, graph } = await flowWith(["Plan"]);
    const token = "ghp_" + "b".repeat(30);
    await saveFlow(db, flowId, { ...graph, nodes: graph.nodes.map((n) => ({ ...n, extraInstructions: `use ${token}` })) }, ann, t(1));
    expect(JSON.stringify(await db.select().from(schema.flowVersion))).not.toContain(token);
    const version = (await history(flowId))[0]!;
    expect(JSON.stringify((await getFlowVersion(db, flowId, version.id))!.version.snapshot)).toContain("•••");
  });

  it("getFlowVersion gives the version and the one before it", async () => {
    const { flowId, graph } = await flowWith(["Plan"]);
    await saveFlow(db, flowId, { ...graph, name: "Two" }, ann, t(1));
    const [latest, first] = await history(flowId);
    const view = (await getFlowVersion(db, flowId, latest!.id))!;
    expect([view.version.snapshot.name, view.previous?.id]).toEqual(["Two", first!.id]);
    expect(await getFlowVersion(db, flowId, uuid())).toBeNull();
  });
});

describe("library Nodes (FLW-10)", () => {
  it("editing a Node adds a version to every Flow that uses it, and not to others", async () => {
    const one = await flowWith(["Plan"]);
    await saveFlow(db, one.flowId, one.graph, ann, t(1));
    const other = await createFlow(db, "Other", ann, t(1));
    const second = (await cloneFlow(db, one.flowId, ann, t(2)))!;
    expect(await updateNode(db, one.libs[0]!.id, agent("Plan", "better plan"), bob, t(3))).toEqual({ ok: true, flows: 2 });
    for (const id of [one.flowId, second.id]) {
      const [latest] = await history(id);
      expect(latest).toMatchObject({ kind: "library-node", actorEmail: bob });
      expect(latest!.summary.map(describeChange)).toEqual(['Node "Plan" changed in the library (instructions edited)']);
    }
    expect((await history(other.id)).map((v) => v.kind)).toEqual(["create"]);
  });

  it("an edit that is refused (locked) records nothing", async () => {
    const f = await flowWith(["Plan"]);
    await saveFlow(db, f.flowId, f.graph, ann, t(1));
    await lockFlow(f.flowId);
    const before = (await history(f.flowId)).length;
    expect(await updateNode(db, f.libs[0]!.id, agent("Plan", "x"), bob, t(3))).toMatchObject({ ok: false, reason: "locked" });
    expect(await history(f.flowId)).toHaveLength(before);
    expect(await updateNode(db, uuid(), agent("Plan"), bob, t(3))).toMatchObject({ ok: false, reason: "not-found" });
  });
});

describe("restore", () => {
  it("rewrites the graph from a version and records a restore", async () => {
    const f = await flowWith(["Plan", "Implement"]);
    await saveFlow(db, f.flowId, f.graph, ann, t(1));
    const good = (await history(f.flowId))[0]!;
    await saveFlow(db, f.flowId, { name: "Broken", nodes: [f.graph.nodes[0]!], edges: [] }, bob, t(2));

    expect(await restoreFlowVersion(db, f.flowId, good.id, bob, t(3))).toMatchObject({ ok: true, versionId: expect.any(String) });
    const detail = (await loadFlowDetail(db, f.flowId))!;
    expect([detail.flow.name, detail.nodes.length, detail.edges.length]).toEqual(["Ship", 3, 2]);
    const [latest] = await history(f.flowId);
    expect(latest).toMatchObject({ kind: "restore", actorEmail: bob, detail: { restoredFromVersionId: good.id } });
    expect(latest!.summary.map(describeChange)).toContain('Node "Implement" added');
  });

  it("is refused while a Run is active (FLW-7), and for a missing Flow or version", async () => {
    const f = await flowWith(["Plan"]);
    await saveFlow(db, f.flowId, f.graph, ann, t(1));
    const [v] = await history(f.flowId);
    await lockFlow(f.flowId);
    const before = (await history(f.flowId)).length;
    expect(await restoreFlowVersion(db, f.flowId, v!.id, ann, t(2))).toMatchObject({ ok: false, reason: "locked" });
    expect(await restoreFlowVersion(db, f.flowId, uuid(), ann, t(2))).toEqual({ ok: false, reason: "not-found" });
    expect(await restoreFlowVersion(db, uuid(), v!.id, ann, t(2))).toEqual({ ok: false, reason: "not-found" });
    expect(await history(f.flowId)).toHaveLength(before);
  });

  it("makes a deleted library Node again from the stored definition, as Copy of when the name is taken", async () => {
    const f = await flowWith(["Plan"]);
    await saveFlow(db, f.flowId, f.graph, ann, t(1));
    const v = (await history(f.flowId))[0]!;
    await saveFlow(db, f.flowId, { name: "Ship", nodes: [f.graph.nodes[0]!], edges: [] }, ann, t(2));
    expect(await deleteNode(db, f.libs[0]!.id)).toMatchObject({ ok: true });
    await createNode(db, agent("Plan", "another"), ann, t(2));
    expect(await restoreFlowVersion(db, f.flowId, v.id, ann, t(3))).toMatchObject({ ok: true });
    const names = (await db.select({ name: schema.node.name }).from(schema.node)).map((n) => n.name);
    expect(names).toEqual(expect.arrayContaining(["Plan", "Copy of Plan"]));
  });
});

describe("deleted Flows", () => {
  it("keep their history, are listed with who deleted them, and can be cloned from a version", async () => {
    const f = await flowWith(["Plan"]);
    await saveFlow(db, f.flowId, f.graph, ann, t(1));
    const live = await createFlow(db, "Stays", ann, t(1));
    expect(await deleteFlow(db, f.flowId, bob, t(5))).toMatchObject({ ok: true, name: "Ship", versionId: expect.any(String) });

    const deleted = await listDeletedFlows(db);
    expect(deleted).toEqual([expect.objectContaining({ flowId: f.flowId, name: "Ship", deletedByEmail: bob, deletedAt: t(5) })]);
    expect(deleted.some((d) => d.flowId === live.id)).toBe(false);
    expect((await history(f.flowId)).map((v) => v.kind)).toEqual(["delete", "update", "create"]);

    const cloned = await cloneFlowVersion(db, f.flowId, deleted[0]!.versionId, bob, t(6));
    if (!cloned.ok) throw new Error("clone failed");
    expect(cloned.name).toBe("Ship");
    const copy = (await loadFlowDetail(db, cloned.id))!;
    expect([copy.nodes.length, copy.edges.length]).toEqual([2, 1]);
    expect(await history(cloned.id)).toEqual([expect.objectContaining({ kind: "clone", detail: { clonedFrom: f.flowId, restoredFromVersionId: deleted[0]!.versionId } })]);
    // Cloning again works and the names stay apart.
    expect(await cloneFlowVersion(db, f.flowId, deleted[0]!.versionId, bob, t(7))).toMatchObject({ ok: true, name: "Copy of Ship" });
    expect(await cloneFlowVersion(db, f.flowId, uuid(), bob, t(7))).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("migration backfill", () => {
  it("gives each Flow without history one baseline version, masked", async () => {
    const f = await flowWith(["Plan"]);
    const token = "ghp_" + "c".repeat(30);
    await saveFlow(db, f.flowId, f.graph, ann, t(1));
    await db.update(schema.flowNode).set({ extraInstructions: `see ${token}` }).where(eq(schema.flowNode.flowId, f.flowId));
    await db.delete(schema.flowVersion);
    const file = readFileSync(new URL("../drizzle/0018_flow_history.sql", import.meta.url), "utf8");
    for (const statement of file.split("--> statement-breakpoint").filter((s) => /flow_history_mask|INSERT INTO "flow_version"/.test(s))) await db.execute(sql.raw(statement));

    const [only] = await history(f.flowId);
    expect(only).toMatchObject({ seq: 1, kind: "baseline", flowName: "Ship", actorEmail: ann, summary: [{ type: "baseline" }] });
    const [row] = await db.select().from(schema.flowVersion);
    expect(row!.snapshot.nodes).toHaveLength(2);
    expect(row!.snapshot.edges).toHaveLength(1);
    expect(JSON.stringify(row!.snapshot)).not.toContain(token);
    expect(JSON.stringify(row!.snapshot)).toContain("•••");
    // A later save diffs against the baseline.
    await saveFlow(db, f.flowId, { ...f.graph, name: "Ship 2" }, ann, t(9));
    expect((await history(f.flowId))[0]!.summary.map(describeChange)).toContain('Flow renamed from "Ship" to "Ship 2"');
  });
});
