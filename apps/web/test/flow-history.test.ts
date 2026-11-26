import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { listAudit, loadFlowDetail, schema, sql, type Db, type FlowGraphInput } from "@clauderon/db";
import { FakeClock, FakeGitHub, createTestDatabase, machineRow, memberRow, projectRow, sampleFlowId, startSampleBatch, ticketRow, type TestDatabase } from "@clauderon/testing";
import type { AppDeps } from "../src/server/deps";
import {
  cloneMyDeletedFlow,
  compareSnapshots,
  cloneMyFlow,
  createMyFlow,
  deleteMyFlow,
  restoreMyFlowVersion,
  saveMyFlow,
  viewDeletedFlows,
  viewFlowHistory,
  viewFlowVersion,
  type SnapshotView,
} from "../src/server/flows";
import { updateMyNode } from "../src/server/library";

let test: TestDatabase;
let db: Db;
let deps: AppDeps;

beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
});
afterAll(() => test.drop());
beforeEach(async () => {
  await db.execute(sql`truncate member, machine, pairing, project, ticket, batch, run, attempt, output, audit_entry, flow, flow_version, node cascade`);
  deps = { db, operators: [], clock: new FakeClock(), publish: () => {}, command: async () => {}, github: new FakeGitHub() };
});

/** The editor's graph of a Flow, with a rename applied. */
async function graphOf(flowId: string, rename?: string): Promise<FlowGraphInput> {
  const d = (await loadFlowDetail(db, flowId))!;
  return { name: rename ?? d.flow.name, nodes: d.nodes, edges: d.edges };
}

describe("Flow history on the Flows page (issue #181)", () => {
  it("lists create, edit and delete with who and when, in plain words, newest first", async () => {
    const ann = await memberRow(db, "ann@example.com", "Ann");
    const bob = await memberRow(db, "bob@example.com", "Bob");
    const made = await createMyFlow(deps, ann, "Ship");
    if (!made.ok) throw new Error("create failed");
    expect(await saveMyFlow(deps, bob, made.flowId, await graphOf(made.flowId, "Ship it"))).toMatchObject({ ok: true });

    const view = (await viewFlowHistory(deps, made.flowId))!;
    expect(view).toMatchObject({ name: "Ship it", deleted: false, lock: null });
    expect(view.entries.map((e) => [e.label, e.actorName])).toEqual([
      ["Edited", "Bob"],
      ["Created", "Ann"],
    ]);
    expect(view.entries[0]!.summary).toEqual(['Flow renamed from "Ship" to "Ship it"']);

    expect(await deleteMyFlow(deps, ann, made.flowId)).toEqual({ ok: true });
    const after = (await viewFlowHistory(deps, made.flowId))!;
    expect(after.deleted).toBe(true);
    expect(after.entries.map((e) => e.label)).toEqual(["Deleted", "Edited", "Created"]);
    expect(await viewFlowHistory(deps, crypto.randomUUID())).toBeNull();
  });

  it("a version opens with the graph before and after it", async () => {
    await sampleFlowId(db); // seeds the Ticket Input Node a new Flow starts with
    const ann = await memberRow(db, "ann@example.com");
    const made = await createMyFlow(deps, ann, "Ship");
    if (!made.ok) throw new Error("create failed");
    await saveMyFlow(deps, ann, made.flowId, await graphOf(made.flowId, "Ship 2"));
    const [latest] = (await viewFlowHistory(deps, made.flowId))!.entries;
    const version = (await viewFlowVersion(deps, made.flowId, latest!.id))!;
    expect([version.before?.name, version.after.name]).toEqual(["Ship", "Ship 2"]);
    expect(version.after.nodes.length).toBeGreaterThan(0);
    expect(version.after.links).toHaveLength(version.after.edges.length);
    expect(version).toMatchObject({ count: 2, newerId: null });
    expect(version.olderId).not.toBeNull();
    const oldest = (await viewFlowVersion(deps, made.flowId, version.olderId!))!;
    expect(oldest).toMatchObject({ before: null, olderId: null, newerId: latest!.id });
    expect(await viewFlowVersion(deps, made.flowId, crypto.randomUUID())).toBeNull();
  });

  it("compares two versions Node by Node and connection by connection", () => {
    const node = (name: string, instructions = "Do it.", kind = "agent") => ({ name, kind, instructions, extraInstructions: "" });
    const link = (from: string, to: string) => ({ from, output: "plan", to, input: "plan" });
    const snap = (nodes: SnapshotView["nodes"], links: SnapshotView["links"]): SnapshotView => ({ name: "F", nodes, links, edges: links.map((l) => `${l.from} → ${l.to}`) });
    const before = snap([node("Plan"), node("Review"), node("Old")], [link("Plan", "Review"), link("Plan", "Old")]);
    const after = snap([node("Plan"), node("Review", "Look closer."), node("Test", "pnpm test", "command")], [link("Plan", "Review"), link("Review", "Test")]);
    const diff = compareSnapshots(before, after);
    expect(diff.nodes.map((n) => [n.name, n.status])).toEqual([
      ["Plan", "same"],
      ["Review", "changed"],
      ["Test", "added"],
      ["Old", "removed"],
    ]);
    expect(diff.nodes[1]!.fields).toEqual(["instructions"]);
    expect(diff.links.map((l) => [l.link.to, l.status])).toEqual([
      ["Review", "same"],
      ["Test", "added"],
      ["Old", "removed"],
    ]);
    // Two Nodes of one name pair up in order; the first version has nothing to compare against.
    expect(compareSnapshots(snap([node("A"), node("A")], []), snap([node("A"), node("A", "New")], [])).nodes.map((n) => n.status)).toEqual(["same", "changed"]);
    expect(compareSnapshots(null, after).nodes.every((n) => n.status === "same")).toBe(true);
  });

  it("deleted Flows are listed with who deleted them, and a version can be cloned", async () => {
    const ann = await memberRow(db, "ann@example.com", "Ann");
    const bob = await memberRow(db, "bob@example.com", "Bob");
    const made = await createMyFlow(deps, ann, "Ship");
    if (!made.ok) throw new Error("create failed");
    await deleteMyFlow(deps, bob, made.flowId);
    const deleted = await viewDeletedFlows(deps);
    expect(deleted).toEqual([expect.objectContaining({ flowId: made.flowId, name: "Ship", deletedByName: "Bob" })]);

    const copy = await cloneMyDeletedFlow(deps, ann, made.flowId, deleted[0]!.versionId);
    expect(copy).toMatchObject({ ok: true, name: "Ship" });
    expect(await cloneMyDeletedFlow(deps, ann, made.flowId, crypto.randomUUID())).toMatchObject({ ok: false });
    expect(await viewDeletedFlows(deps)).toHaveLength(1);
  });

  it("restore brings a version back, records it, and is refused while a Run is active (FLW-7)", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const made = await createMyFlow(deps, ann, "Ship");
    if (!made.ok) throw new Error("create failed");
    await saveMyFlow(deps, ann, made.flowId, await graphOf(made.flowId, "Renamed"));
    const first = (await viewFlowHistory(deps, made.flowId))!.entries.at(-1)!;

    expect(await restoreMyFlowVersion(deps, ann, made.flowId, first.id)).toEqual({ ok: true });
    expect((await loadFlowDetail(db, made.flowId))!.flow.name).toBe("Ship");
    expect((await viewFlowHistory(deps, made.flowId))!.entries[0]).toMatchObject({ label: "Restored", restoredFromVersionId: first.id });
    expect(await restoreMyFlowVersion(deps, ann, made.flowId, crypto.randomUUID())).toMatchObject({ ok: false, error: expect.stringContaining("no longer exists") });

    const flowId = await sampleFlowId(db);
    const machine = await machineRow(db, ann.id);
    const project = await projectRow(db);
    const ticket = await ticketRow(db, project.id, 1);
    await startSampleBatch(db, ann, machine.id, [ticket.id], new Date("2026-11-16T09:00:00Z"));
    const sampleVersion = (await viewFlowHistory(deps, flowId))!.entries[0]!;
    expect((await viewFlowHistory(deps, flowId))!.lock).not.toBeNull();
    expect(await restoreMyFlowVersion(deps, ann, flowId, sampleVersion.id)).toMatchObject({ ok: false, error: expect.stringContaining("Locked by Run") });
  });

  it("a library Node edit shows in the history of each Flow that uses it", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const flowId = await sampleFlowId(db, "plan-and-deliver");
    const [plan] = await db.select().from(schema.node).where(sql`slug = 'grill-a-plan'`);
    const result = await updateMyNode(deps, ann, plan!.id, { name: plan!.name, kind: plan!.kind, instructions: "A better plan", command: null, inputs: plan!.inputs, outputs: plan!.outputs });
    expect(result).toMatchObject({ ok: true });
    const [latest] = (await viewFlowHistory(deps, flowId))!.entries;
    expect(latest!.label).toBe("Library Node changed");
    expect(latest!.summary[0]).toContain("changed in the library (instructions edited)");
  });

  it("clone, audit entries keep their shape and now carry the version for the History link", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const flowId = await sampleFlowId(db);
    const copy = await cloneMyFlow(deps, ann, flowId);
    if (!copy.ok) throw new Error("clone failed");
    const { rows } = await listAudit(db, {});
    expect(rows[0]).toMatchObject({ action: "flow.create", subjectType: "flow", subjectId: copy.flowId, detail: { clonedFrom: flowId, versionId: expect.any(String) } });
    const [entry] = (await viewFlowHistory(deps, copy.flowId))!.entries;
    expect(entry).toMatchObject({ label: "Cloned", clonedFrom: flowId, id: (rows[0]!.detail as { versionId: string }).versionId });
  });

  it("masks known token patterns in instructions shown in a version (NFR-1)", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const flowId = await sampleFlowId(db);
    const token = "ghp_" + "d".repeat(30);
    const graph = await graphOf(flowId);
    await saveMyFlow(deps, ann, flowId, { ...graph, nodes: graph.nodes.map((n) => ({ ...n, extraInstructions: `token ${token}` })) });
    const [latest] = (await viewFlowHistory(deps, flowId))!.entries;
    const text = JSON.stringify(await viewFlowVersion(deps, flowId, latest!.id));
    expect(text).not.toContain(token);
    expect(text).toContain("•••");
  });
});
