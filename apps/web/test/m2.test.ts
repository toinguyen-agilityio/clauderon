import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadFlow, loadFlowDetail, loadLibrary, schema, sql, type Db, type GatewayCommand } from "@clauderon/db";
import {
  FakeClock,
  FakeGitHub,
  createTestDatabase,
  memberRow,
  machineRow,
  projectRow,
  sampleFlowId,
  startSampleBatch,
  ticketRow,
  type TestDatabase,
} from "@clauderon/testing";
import type { AppDeps } from "../src/server/deps";
import { cloneMyFlow, createMyFlow, deleteMyFlow, editorData, exportMyFlow, importMyFlow, saveMyFlow, viewFlows } from "../src/server/flows";
import { startDialog } from "../src/server/start";
import { cloneMyNode, createMyNode, deleteMyNode, updateMyNode, viewLibrary } from "../src/server/library";

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
  await db.execute(sql`truncate member, machine, pairing, project, ticket, batch, run, attempt, output, audit_entry, flow, node cascade`);
  commands = [];
  deps = {
    db,
    operators: [],
    clock: new FakeClock(),
    publish: () => {},
    command: async (c) => void commands.push(c),
    github: new FakeGitHub(),
  };
});

const actions = async () => (await db.select().from(schema.auditEntry)).map((a) => a.action);

async function withDryRun(flowId: string) {
  const ann = await memberRow(db, "ann@example.com", "Ann");
  const machine = await machineRow(db, ann.id);
  const project = await projectRow(db);
  const ticket = await ticketRow(db, project.id, 1);
  await startSampleBatch(db, ann, machine.id, [ticket.id], new Date("2026-11-16T09:00:00Z"), "", "dry");
  return { ann, flowId };
}

describe("Flows page (spec M2 §2)", () => {
  it("lists samples apart from Flows, each with Node count and no problems", async () => {
    await sampleFlowId(db);
    const { samples, flows } = await viewFlows(deps);
    expect(samples.map((f) => f.name).sort()).toEqual(["Basic ticket delivery", "Plan and deliver"]);
    expect(flows).toEqual([]);
    expect(samples.map((f) => [f.name, f.isSample, f.problems, f.nodeCount, f.lock])).toEqual([[expect.any(String), true, 0, expect.any(Number), null], [expect.any(String), true, 0, expect.any(Number), null]]);
    expect(samples.every((f) => f.nodeCount > 0)).toBe(true);
    // each Flow lists its Nodes for the row preview, the entry Ticket first
    expect(samples.every((f) => f.nodes.length === f.nodeCount && f.nodes[0]?.kind === "ticket")).toBe(true);
  });

  it("T2-7: clone copies the placements and edges into an editable Flow named '<name> (copy)'; a sample can be deleted too", async () => {
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

    expect(await deleteMyFlow(deps, ann, copy.flowId)).toEqual({ ok: true });
    expect(await deleteMyFlow(deps, ann, flowId)).toEqual({ ok: true });
    expect(await actions()).toEqual(["flow.create", "flow.delete", "flow.delete"]);
  });

  it("T2-5: a Flow with an Active Dry-run Run shows the lock, refuses delete on the server, and can still be cloned", async () => {
    const flowId = await sampleFlowId(db);
    const ann = await memberRow(db, "ann@example.com");
    const copy = await cloneMyFlow(deps, ann, flowId);
    if (!copy.ok) throw new Error("clone failed");
    // A Run of the clone (Dry-run counts: FLW-7).
    const machine = await machineRow(db, ann.id);
    const project = await projectRow(db);
    const ticket = await ticketRow(db, project.id, 7);
    const { buildFlowSnapshot, startBatch } = await import("@clauderon/db");
    const snapshot = (await buildFlowSnapshot(db, copy.flowId))!;
    const started = await startBatch(db, { flowId: copy.flowId, flowSnapshot: snapshot, starter: ann, machineId: machine.id, mode: "dry", extraInstructions: "", ticketIds: [ticket.id] }, new Date());
    if (!started.ok) throw new Error("start failed");

    const { flows } = await viewFlows(deps);
    expect(flows[0]!.lock).toEqual({ runId: started.runIds[0], state: "queued" });
    const refused = await deleteMyFlow(deps, ann, copy.flowId);
    expect(refused).toMatchObject({ ok: false, error: expect.stringContaining(`Locked by Run ${started.runIds[0]}`) });
    expect((await cloneMyFlow(deps, ann, copy.flowId)).ok).toBe(true);
    expect((await viewFlows(deps)).flows).toHaveLength(2);
  });

  it("New Flow: starts with the Ticket Node placed, opens editable, and a taken name gets 'Copy of'", async () => {
    await sampleFlowId(db);
    const ann = await memberRow(db, "ann@example.com");
    expect(await createMyFlow(deps, ann, "   ")).toEqual({ ok: false, error: "Give the Flow a name." });
    const made = await createMyFlow(deps, ann, "  My flow ");
    if (!made.ok) throw new Error("create failed");
    expect(made.name).toBe("My flow");
    const data = (await editorData(deps, made.flowId))!;
    expect(data.readOnly).toBe(false);
    expect(data.flow.isSample).toBe(false);
    const library = await loadLibrary(db);
    expect(data.graph.nodes.map((n) => library.find((l) => l.id === n.nodeId)!.kind)).toEqual(["ticket"]);
    expect(data.graph.edges).toEqual([]);
    expect(await createMyFlow(deps, ann, "basic TICKET delivery")).toMatchObject({ ok: true, name: "Copy of basic TICKET delivery" });
    expect(await actions()).toEqual(["flow.create", "flow.create"]);
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

  it("a sample opens editable and its save is stored", async () => {
    const flowId = await sampleFlowId(db);
    const ann = await memberRow(db, "ann@example.com");
    const data = (await editorData(deps, flowId))!;
    expect(data.readOnly).toBe(false);
    expect(await saveMyFlow(deps, ann, flowId, { name: "Edited sample", ...data.graph })).toEqual({ ok: true, problems: 0 });
    expect((await loadFlowDetail(db, flowId))!.flow).toMatchObject({ name: "Edited sample", isSample: true });
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
    const machine = await machineRow(db, ann.id);
    const ticket = await ticketRow(db, (await projectRow(db)).id, 5);
    const { buildFlowSnapshot, startBatch } = await import("@clauderon/db");
    const started = await startBatch(
      db,
      { flowId: copyId, flowSnapshot: (await buildFlowSnapshot(db, copyId))!, starter: ann, machineId: machine.id, mode: "dry", extraInstructions: "", ticketIds: [ticket.id] },
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

describe("Node panel (spec M2 §3, FLW-6)", () => {
  it("saves a label, extra instructions and optional Outputs for a placement", async () => {
    const flowId = await sampleFlowId(db);
    const ann = await memberRow(db, "ann@example.com");
    const copy = await cloneMyFlow(deps, ann, flowId);
    if (!copy.ok) throw new Error("clone failed");
    const library = await loadLibrary(db);
    const data = (await editorData(deps, copy.flowId))!;
    const code = data.graph.nodes.find((n) => library.find((l) => l.id === n.nodeId)!.name === "Code a change")!;
    const nodes = data.graph.nodes.map((n) => (n.id === code.id ? { ...n, label: "Write the fix", extraInstructions: "Keep the API.", enabledOptionalOutputs: ["summary"] } : n));
    expect(await saveMyFlow(deps, ann, copy.flowId, { name: data.flow.name, nodes, edges: data.graph.edges })).toMatchObject({ ok: true });
    const saved = (await loadFlowDetail(db, copy.flowId))!.nodes.find((n) => n.id === code.id)!;
    expect(saved).toMatchObject({ label: "Write the fix", extraInstructions: "Keep the API.", enabledOptionalOutputs: ["summary"] });
    // The placement's label reaches a Run's snapshot, and its extra instructions reach the Agent prompt (spec M1 §4.2).
    const { buildFlowSnapshot } = await import("@clauderon/db");
    const snapshotNode = (await buildFlowSnapshot(db, copy.flowId))!.nodes.find((n) => n.id === code.id)!;
    expect(snapshotNode).toMatchObject({ name: "Write the fix", extraInstructions: "Keep the API." });
  });

  it("T2-10: turning off an optional Output that has an edge adds a problem, and saving still works", async () => {
    // Plan and deliver already sends the optional `summary` of Code a change to Open a pull request.
    const flowId = await sampleFlowId(db, "plan-and-deliver");
    const ann = await memberRow(db, "ann@example.com");
    const copy = await cloneMyFlow(deps, ann, flowId);
    if (!copy.ok) throw new Error("clone failed");
    const library = await loadLibrary(db);
    const data = (await editorData(deps, copy.flowId))!;
    const code = data.graph.nodes.find((n) => library.find((l) => l.id === n.nodeId)!.name === "Code a change")!;
    expect(code.enabledOptionalOutputs).toEqual(["summary"]);
    expect(await saveMyFlow(deps, ann, copy.flowId, { name: data.flow.name, nodes: data.graph.nodes, edges: data.graph.edges })).toEqual({ ok: true, problems: 0 });
    const off = data.graph.nodes.map((n) => (n.id === code.id ? { ...n, enabledOptionalOutputs: [] } : n));
    expect(await saveMyFlow(deps, ann, copy.flowId, { name: data.flow.name, nodes: off, edges: data.graph.edges })).toEqual({ ok: true, problems: 1 });
  });
});

describe("Export and import a Flow (issue #98)", () => {
  const exported = async (flowId: string) => {
    const result = await exportMyFlow(deps, flowId);
    if (!result.ok) throw new Error(result.error);
    return result;
  };

  it("round trips a sample Flow into a new Flow of the member's own, without touching anything", async () => {
    const sample = await sampleFlowId(db);
    const ann = await memberRow(db, "ann@example.com");
    const { json, filename } = await exported(sample);
    expect(filename).toBe("basic-ticket-delivery.flow.json");
    expect(json).not.toContain("ann@example.com");

    const nodesBefore = (await viewLibrary(deps)).length;
    const result = await importMyFlow(deps, ann, json);
    if (!result.ok) throw new Error(result.error);
    // The sample already has this name, so the copy gets another; every Node is reused.
    expect(result.name).toBe("Copy of Basic ticket delivery");
    expect(result.createdNodes).toBe(0);
    expect((await viewLibrary(deps)).length).toBe(nodesBefore);

    const copy = await loadFlowDetail(db, result.flowId);
    const original = await loadFlowDetail(db, sample);
    expect(copy!.flow.isSample).toBe(false);
    expect(copy!.nodes.map((n) => [n.nodeId, n.label, n.x, n.y]).sort()).toEqual(original!.nodes.map((n) => [n.nodeId, n.label, n.x, n.y]).sort());
    expect(copy!.edges).toHaveLength(original!.edges.length);
    expect((await viewFlows(deps)).flows.find((f) => f.id === result.flowId)!.problems).toBe(0);
    expect((await viewFlows(deps)).samples).toHaveLength(2);
    expect(await actions()).toContain("flow.create");
  });

  it("creates the Nodes a file brings that this library lacks, and renames one that only shares a name", async () => {
    const sample = await sampleFlowId(db);
    const ann = await memberRow(db, "ann@example.com");
    const file = JSON.parse((await exported(sample)).json);
    // A new Node, and a Node that shares a name with a sample but is different.
    const agent = file.nodes.find((n: { kind: string }) => n.kind === "agent");
    const original = agent.name;
    agent.instructions = "A different prompt.";
    const result = await importMyFlow(deps, ann, JSON.stringify({ ...file, name: "Brand new flow" }));
    if (!result.ok) throw new Error(result.error);
    expect(result.name).toBe("Brand new flow");
    expect(result.createdNodes).toBeGreaterThan(0);
    const library = await viewLibrary(deps);
    const made = library.find((n) => n.name === "Copy of " + original);
    expect(made).toMatchObject({ isSample: false, instructions: "A different prompt." });
    // The sample Node is untouched.
    expect(library.find((n) => n.name === original)).toMatchObject({ isSample: true });
  });

  it("an invalid file creates nothing", async () => {
    await sampleFlowId(db);
    const ann = await memberRow(db, "ann@example.com");
    const flowsBefore = await db.select().from(schema.flow);
    const nodesBefore = await db.select().from(schema.node);
    for (const text of ["{oops", JSON.stringify({ format: "clauderon-flow", version: 2 }), JSON.stringify({ format: "clauderon-flow", version: 1, name: "x", nodes: [], placements: [{ id: "a", node: "n" }], edges: [] })]) {
      expect(await importMyFlow(deps, ann, text)).toMatchObject({ ok: false });
    }
    expect(await db.select().from(schema.flow)).toHaveLength(flowsBefore.length);
    expect(await db.select().from(schema.node)).toHaveLength(nodesBefore.length);
  });
});

describe("Node library (spec M2 §4)", () => {
  const lint = (extra: object = {}) => ({
    name: "Lint",
    kind: "command",
    instructions: "",
    command: "npm run lint",
    inputs: [{ name: "branch", type: "branch", required: true }],
    outputs: [{ name: "report", type: "summary", optional: false }],
    ...extra,
  });

  /** A Flow of its own that uses the custom Lint Node, fed by the branch of Code a change. */
  async function flowUsingLint() {
    const ann = await memberRow(db, "ann@example.com", "Ann");
    const sample = await sampleFlowId(db);
    const copy = await cloneMyFlow(deps, ann, sample);
    if (!copy.ok) throw new Error("clone failed");
    expect(await createMyNode(deps, ann, lint())).toMatchObject({ ok: true });
    const library = await loadLibrary(db);
    const lintId = library.find((n) => n.name === "Lint")!.id;
    const data = (await editorData(deps, copy.flowId))!;
    const placed = (name: string) => data.graph.nodes.find((n) => library.find((l) => l.id === n.nodeId)!.name === name)!;
    const placement = { id: crypto.randomUUID(), nodeId: lintId, label: null, extraInstructions: "", enabledOptionalOutputs: [], x: 0, y: 0 };
    const edges = [
      ...data.graph.edges,
      { id: crypto.randomUUID(), fromFlowNodeId: placed("Code a change").id, fromOutput: "branch", toFlowNodeId: placement.id, toInput: "branch" },
    ];
    expect(await saveMyFlow(deps, ann, copy.flowId, { name: data.flow.name, nodes: [...data.graph.nodes, placement], edges })).toEqual({ ok: true, problems: 0 });
    return { ann, lintId, flowId: copy.flowId };
  }

  it("any Member creates a Node; the Ticket kind and a bad definition are refused; audit node.create", async () => {
    const ann = await memberRow(db, "ann@example.com");
    expect(await createMyNode(deps, ann, lint())).toEqual({ ok: true, flows: 0, withProblems: 0 });
    expect(await createMyNode(deps, ann, lint({ kind: "ticket" }))).toMatchObject({ ok: false });
    expect(await createMyNode(deps, ann, lint({ command: "" }))).toEqual({ ok: false, error: "A Command Node needs a command." });
    expect((await viewLibrary(deps)).find((n) => n.name === "Lint")).toMatchObject({ isSample: false, kind: "command", usedBy: [] });
    expect(await actions()).toEqual(["node.create"]);
  });

  it("issue #94: cloning a sample Node makes an editable copy, avoids a name clash and leaves the sample alone", async () => {
    await sampleFlowId(db);
    const ann = await memberRow(db, "ann@example.com");
    const find = async (name: string) => (await viewLibrary(deps)).find((n) => n.name === name)!;
    const sample = await find("Code a change");
    expect(sample.isSample).toBe(true);

    const first = await cloneMyNode(deps, ann, sample.id);
    expect(first).toMatchObject({ ok: true, name: "Copy of Code a change" });
    const copy = await find("Copy of Code a change");
    expect(copy).toMatchObject({ isSample: false, kind: sample.kind, instructions: sample.instructions, command: sample.command, inputs: sample.inputs, outputs: sample.outputs, usedBy: [] });

    // A second clone does not clash with the first.
    expect(await cloneMyNode(deps, ann, sample.id)).toMatchObject({ ok: true, name: "Copy of Code a change (2)" });

    // The sample is unchanged and its Flows still use it.
    expect(await find("Code a change")).toEqual(sample);
    expect(await actions()).toEqual(["node.create", "node.create"]);

    // Only samples are cloned; the Ticket sample is refused.
    expect(await cloneMyNode(deps, ann, copy.id)).toEqual({ ok: false, error: "Only sample Nodes can be cloned." });
    const ticket = (await viewLibrary(deps)).find((n) => n.kind === "ticket")!;
    expect(await cloneMyNode(deps, ann, ticket.id)).toMatchObject({ ok: false });
    expect(await cloneMyNode(deps, ann, crypto.randomUUID())).toEqual({ ok: false, error: "That Node no longer exists." });
  });

  it("T2-6: editing an unlocked Node re-validates every Flow using it and says how many changed", async () => {
    const { ann, lintId, flowId } = await flowUsingLint();
    expect((await viewLibrary(deps)).find((n) => n.id === lintId)!.usedBy.map((u) => u.flowId)).toEqual([flowId]);
    // Renaming keeps the Flow valid.
    expect(await updateMyNode(deps, ann, lintId, lint({ name: "Lint code" }))).toEqual({ ok: true, flows: 1, withProblems: 0 });
    // Dropping the input the Flow feeds gives that Flow a problem, and the change is saved.
    expect(await updateMyNode(deps, ann, lintId, lint({ inputs: [] }))).toEqual({ ok: true, flows: 1, withProblems: 1 });
    expect((await viewFlows(deps)).flows[0]!.problems).toBeGreaterThan(0);
    expect(await actions()).toEqual(expect.arrayContaining(["node.create", "node.update"]));
  });

  it("T2-6: editing or deleting a Node used by a locked Flow is refused, naming the Flow and the Run", async () => {
    const { ann, lintId, flowId } = await flowUsingLint();
    const machine = await machineRow(db, ann.id);
    const ticket = await ticketRow(db, (await projectRow(db)).id, 9);
    const { buildFlowSnapshot, startBatch } = await import("@clauderon/db");
    const started = await startBatch(
      db,
      { flowId, flowSnapshot: (await buildFlowSnapshot(db, flowId))!, starter: ann, machineId: machine.id, mode: "dry", extraInstructions: "", ticketIds: [ticket.id] },
      new Date(),
    );
    if (!started.ok) throw new Error("start failed");
    const edited = await updateMyNode(deps, ann, lintId, lint({ command: "npm run lint:fix" }));
    expect(edited).toMatchObject({ ok: false, error: expect.stringContaining("Basic ticket delivery (copy)") });
    expect(edited).toMatchObject({ error: expect.stringContaining(started.runIds[0]!) });
    expect(await deleteMyNode(deps, ann, lintId)).toMatchObject({ ok: false, error: expect.stringContaining("locked") });
    expect((await viewLibrary(deps)).find((n) => n.id === lintId)!.command).toBe("npm run lint");
  });

  it("a Node still used by a Flow cannot be deleted; an unused one can; samples included", async () => {
    const { ann, lintId } = await flowUsingLint();
    expect(await deleteMyNode(deps, ann, lintId)).toMatchObject({ ok: false, error: expect.stringContaining("Used by Basic ticket delivery (copy)") });
    const spare = await createMyNode(deps, ann, lint({ name: "Spare" }));
    expect(spare.ok).toBe(true);
    const spareId = (await viewLibrary(deps)).find((n) => n.name === "Spare")!.id;
    expect(await deleteMyNode(deps, ann, spareId)).toEqual({ ok: true, flows: 0, withProblems: 0 });

    // "Draft a plan" is a sample no sample Flow places, so it can be edited and then deleted.
    const sampleNode = (await viewLibrary(deps)).find((n) => n.isSample && n.name === "Draft a plan")!;
    expect(sampleNode.usedBy).toEqual([]);
    expect(await updateMyNode(deps, ann, sampleNode.id, lint({ name: "Draft a plan v2" }))).toEqual({ ok: true, flows: 0, withProblems: 0 });
    expect(await deleteMyNode(deps, ann, sampleNode.id)).toEqual({ ok: true, flows: 0, withProblems: 0 });
  });

  it("T2-11: every Flow and Node change writes an audit entry with the Member's email", async () => {
    const { ann, lintId } = await flowUsingLint();
    await updateMyNode(deps, ann, lintId, lint({ name: "Lint 2" }));
    const entries = await db.select().from(schema.auditEntry);
    expect(entries.map((e) => e.action)).toEqual(expect.arrayContaining(["flow.create", "flow.update", "node.create", "node.update"]));
    expect(entries.every((e) => e.actorEmail === "ann@example.com")).toBe(true);
  });
});
