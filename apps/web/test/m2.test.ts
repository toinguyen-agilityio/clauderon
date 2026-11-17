import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadFlow, loadFlowDetail, loadLibrary, schema, sql, type Db, type GatewayCommand } from "@clauderon/db";
import {
  FakeClock,
  FakeGitHub,
  createTestDatabase,
  memberRow,
  podRow,
  projectRow,
  sampleFlowId,
  startSampleBatch,
  ticketRow,
  type TestDatabase,
} from "@clauderon/testing";
import type { AppDeps } from "../src/server/deps";
import { cloneMyFlow, deleteMyFlow, editorData, saveMyFlow, viewFlows } from "../src/server/flows";
import { startDialog } from "../src/server/start";

let test: TestDatabase;
let db: Db;
let deps: AppDeps;
let commands: GatewayCommand[];

beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
});
afterAll(() => test.drop());
beforeEach(async () => {
  await db.execute(sql`truncate member, pod, project, ticket, batch, run, attempt, output, audit_entry, pod_host, flow, node cascade`);
  commands = [];
  deps = {
    db,
    operators: [],
    clock: new FakeClock(),
    publish: () => {},
    command: async (c) => void commands.push(c),
    github: new FakeGitHub(),
    podImage: "ghcr.io/acme/clauderon-pod:test",
    limitCeiling: { slots: 4, cpus: 4, memoryMb: 8192 },
  };
});

const actions = async () => (await db.select().from(schema.auditEntry)).map((a) => a.action);

async function withDryRun(flowId: string) {
  const ann = await memberRow(db, "ann@example.com", "Ann");
  const pod = await podRow(db, ann.id);
  const project = await projectRow(db);
  const ticket = await ticketRow(db, project.id, 1);
  await startSampleBatch(db, ann, pod.id, [ticket.id], new Date("2026-11-16T09:00:00Z"), "", "dry");
  return { ann, flowId };
}

describe("Flows page (spec M2 §2)", () => {
  it("lists samples read-only apart from Flows, each with Node count and no problems", async () => {
    await sampleFlowId(db);
    const { samples, flows } = await viewFlows(deps);
    expect(samples.map((f) => f.name).sort()).toEqual(["Basic ticket delivery", "Plan and deliver"]);
    expect(flows).toEqual([]);
    expect(samples.map((f) => [f.name, f.isSample, f.problems, f.nodeCount, f.lock])).toEqual([[expect.any(String), true, 0, expect.any(Number), null], [expect.any(String), true, 0, expect.any(Number), null]]);
    expect(samples.every((f) => f.nodeCount > 0)).toBe(true);
  });

  it("T2-7: clone copies the placements and edges into an editable Flow named '<name> (copy)'; samples cannot be deleted", async () => {
    const flowId = await sampleFlowId(db);
    const ann = await memberRow(db, "ann@example.com");
    const nodesBefore = (await db.select().from(schema.node)).length;
    const copy = await cloneMyFlow(deps, ann, flowId);
    if (!copy.ok) throw new Error("clone failed");
    expect(copy.name).toBe("Basic ticket delivery (copy)");

    const [made] = await db.select().from(schema.flow).where(sql`${schema.flow.id} = ${copy.flowId}`);
    expect(made).toMatchObject({ isSample: false, clonedFromId: flowId, slug: null, updatedByEmail: "ann@example.com" });
    const [source, clone] = [await loadFlow(db, flowId), await loadFlow(db, copy.flowId)];
    expect(clone.nodes.map((n) => [n.nodeId, n.x, n.y, n.enabledOptionalOutputs]).sort()).toEqual(
      source.nodes.map((n) => [n.nodeId, n.x, n.y, n.enabledOptionalOutputs]).sort(),
    );
    expect(clone.edges).toHaveLength(source.edges.length);
    // Edges point at the copy's own placements, not the sample's.
    const own = new Set(clone.nodes.map((n) => n.id));
    expect(clone.edges.every((e) => own.has(e.fromFlowNodeId) && own.has(e.toFlowNodeId))).toBe(true);
    // Library Nodes are shared, not copied.
    expect(await db.select().from(schema.node)).toHaveLength(nodesBefore);

    expect(await deleteMyFlow(deps, ann, flowId)).toEqual({ ok: false, error: "Sample Flows cannot be deleted. Clone one to change it." });
    expect(await deleteMyFlow(deps, ann, copy.flowId)).toEqual({ ok: true });
    expect(await actions()).toEqual(["flow.create", "flow.delete"]);
  });

  it("T2-5: a Flow with an Active Dry-run Run shows the lock, refuses delete on the server, and can still be cloned", async () => {
    const flowId = await sampleFlowId(db);
    const ann = await memberRow(db, "ann@example.com");
    const copy = await cloneMyFlow(deps, ann, flowId);
    if (!copy.ok) throw new Error("clone failed");
    // A Run of the clone (Dry-run counts: FLW-7).
    const pod = await podRow(db, ann.id);
    const project = await projectRow(db);
    const ticket = await ticketRow(db, project.id, 7);
    const { buildFlowSnapshot, startBatch } = await import("@clauderon/db");
    const snapshot = (await buildFlowSnapshot(db, copy.flowId))!;
    const started = await startBatch(db, { flowId: copy.flowId, flowSnapshot: snapshot, starter: ann, podId: pod.id, mode: "dry", extraInstructions: "", ticketIds: [ticket.id] }, new Date());
    if (!started.ok) throw new Error("start failed");

    const { flows } = await viewFlows(deps);
    expect(flows[0]!.lock).toEqual({ runId: started.runIds[0], state: "queued" });
    const refused = await deleteMyFlow(deps, ann, copy.flowId);
    expect(refused).toMatchObject({ ok: false, error: expect.stringContaining(`Locked by Run ${started.runIds[0]}`) });
    expect((await cloneMyFlow(deps, ann, copy.flowId)).ok).toBe(true);
    expect((await viewFlows(deps)).flows).toHaveLength(2);
  });

  it("a Flow whose Runs have all ended is kept while it has Runs in its history", async () => {
    const flowId = await sampleFlowId(db);
    const { ann } = await withDryRun(flowId);
    await db.update(schema.run).set({ state: "succeeded" });
    const copy = await cloneMyFlow(deps, ann, flowId);
    if (!copy.ok) throw new Error("clone failed");
    // The sample has a Run in its history and is a sample; the clone has none and can go.
    expect((await viewFlows(deps)).samples.every((f) => f.lock === null)).toBe(true);
    expect(await deleteMyFlow(deps, ann, copy.flowId)).toEqual({ ok: true });
  });
});

describe("Canvas editor save (spec M2 §3)", () => {
  async function cloneOf(slug: string) {
    const flowId = await sampleFlowId(db, slug);
    const ann = await memberRow(db, "ann@example.com", "Ann");
    const copy = await cloneMyFlow(deps, ann, flowId);
    if (!copy.ok) throw new Error("clone failed");
    return { ann, flowId, copyId: copy.flowId };
  }

  it("a sample opens read-only and its save is refused on the server", async () => {
    const flowId = await sampleFlowId(db);
    const ann = await memberRow(db, "ann@example.com");
    const data = (await editorData(deps, flowId))!;
    expect(data.readOnly).toBe(true);
    const refused = await saveMyFlow(deps, ann, flowId, { name: "x", ...data.graph });
    expect(refused).toEqual({ ok: false, error: "Sample Flows are read-only. Clone one to change it." });
  });

  it("saves a moved Node and a new name, with an audit entry, and keeps the Flow startable", async () => {
    const { ann, copyId } = await cloneOf("basic-ticket-delivery");
    const data = (await editorData(deps, copyId))!;
    expect(data.readOnly).toBe(false);
    const nodes = data.graph.nodes.map((n, i) => (i === 0 ? { ...n, x: 321, y: 123 } : n));
    expect(await saveMyFlow(deps, ann, copyId, { name: "My flow", nodes, edges: data.graph.edges })).toEqual({ ok: true, problems: 0 });
    const saved = (await loadFlowDetail(db, copyId))!;
    expect(saved.flow.name).toBe("My flow");
    expect(saved.nodes.find((n) => n.id === nodes[0]!.id)).toMatchObject({ x: 321, y: 123 });
    expect((await db.select().from(schema.auditEntry)).map((a) => a.action)).toContain("flow.update");
    const ticket = await ticketRow(db, (await projectRow(db)).id, 1);
    expect((await startDialog(deps, ann, [ticket.id])).flows.map((f) => f.id)).toContain(copyId);
  });

  it("T2-4 (A3): a plan -> issue edge is saved, counts as a problem, and the Start dialog no longer offers the Flow", async () => {
    const { ann, copyId } = await cloneOf("plan-and-deliver");
    const library = await loadLibrary(db);
    const data = (await editorData(deps, copyId))!;
    const placed = (name: string) => data.graph.nodes.find((n) => library.find((l) => l.id === n.nodeId)!.name === name)!;
    const edge = { id: crypto.randomUUID(), fromFlowNodeId: placed("Grill a plan").id, fromOutput: "plan", toFlowNodeId: placed("Code a change").id, toInput: "issue" };

    const result = await saveMyFlow(deps, ann, copyId, { name: data.flow.name, nodes: data.graph.nodes, edges: [...data.graph.edges, edge] });
    expect(result).toMatchObject({ ok: true });
    expect((result as { problems: number }).problems).toBeGreaterThan(0);
    const flows = (await viewFlows(deps)).flows;
    expect(flows[0]!.problems).toBeGreaterThan(0);
    const ticket = await ticketRow(db, (await projectRow(db)).id, 1);
    expect((await startDialog(deps, ann, [ticket.id])).flows.map((f) => f.id)).not.toContain(copyId);
  });

  it("T2-5: updating a Flow with an Active Dry-run Run is refused by the server, naming the Run", async () => {
    const { ann, copyId } = await cloneOf("basic-ticket-delivery");
    const pod = await podRow(db, ann.id);
    const ticket = await ticketRow(db, (await projectRow(db)).id, 5);
    const { buildFlowSnapshot, startBatch } = await import("@clauderon/db");
    const started = await startBatch(
      db,
      { flowId: copyId, flowSnapshot: (await buildFlowSnapshot(db, copyId))!, starter: ann, podId: pod.id, mode: "dry", extraInstructions: "", ticketIds: [ticket.id] },
      new Date(),
    );
    if (!started.ok) throw new Error("start failed");
    const data = (await editorData(deps, copyId))!;
    expect(data.readOnly).toBe(true);
    const refused = await saveMyFlow(deps, ann, copyId, { name: "changed", nodes: data.graph.nodes, edges: data.graph.edges });
    expect(refused).toMatchObject({ ok: false, error: expect.stringContaining(`Locked by Run ${started.runIds[0]}`) });
    expect((await loadFlowDetail(db, copyId))!.flow.name).toBe("Basic ticket delivery (copy)");
  });

  it("refuses a graph that reuses another Flow's placement ids or is malformed", async () => {
    const { ann, flowId, copyId } = await cloneOf("basic-ticket-delivery");
    const mine = (await editorData(deps, copyId))!;
    const theirs = (await editorData(deps, flowId))!;
    const stolen = [{ ...mine.graph.nodes[0]!, id: theirs.graph.nodes[0]!.id }];
    expect(await saveMyFlow(deps, ann, copyId, { name: "x", nodes: stolen, edges: [] })).toMatchObject({ ok: false });
    expect(await saveMyFlow(deps, ann, copyId, { name: "  ", nodes: mine.graph.nodes, edges: mine.graph.edges })).toMatchObject({ ok: false });
    expect(await saveMyFlow(deps, ann, copyId, { name: "x", nodes: [{ ...mine.graph.nodes[0]!, id: "not-a-uuid" }], edges: [] })).toMatchObject({ ok: false });
    // Nothing was changed by the refused saves.
    expect((await loadFlowDetail(db, copyId))!.nodes).toHaveLength(mine.graph.nodes.length);
  });
});
