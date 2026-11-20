import { and, asc, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { NODE_KINDS, OUTPUT_TYPES, type Flow, type NodeDefinition, type FlowSnapshot, type LibraryNode, type NodeInput, type NodeOutput } from "@clauderon/core";
import type { Db } from "./client";
import { flow, flowEdge, flowNode, node, run } from "./schema";

const isOutputType = (t: string): t is NodeInput["type"] => (OUTPUT_TYPES as readonly string[]).includes(t);

/** The Node library in the shape the domain core validates. */
export async function loadLibrary(db: Db): Promise<LibraryNode[]> {
  const rows = await db.select().from(node);
  return rows.map((n) => ({
    id: n.id,
    name: n.name,
    kind: NODE_KINDS.includes(n.kind) ? n.kind : "agent",
    inputs: n.inputs.filter((i) => isOutputType(i.type)) as NodeInput[],
    outputs: n.outputs.filter((o) => isOutputType(o.type)) as NodeOutput[],
  }));
}

export async function loadFlow(db: Db, flowId: string): Promise<Flow> {
  const nodes = await db.select().from(flowNode).where(eq(flowNode.flowId, flowId));
  const edges = await db.select().from(flowEdge).where(eq(flowEdge.flowId, flowId));
  return {
    nodes: nodes.map((n) => ({ id: n.id, nodeId: n.nodeId, x: n.x, y: n.y, enabledOptionalOutputs: n.enabledOptionalOutputs })),
    edges: edges.map((e) => ({
      id: e.id,
      fromFlowNodeId: e.fromFlowNodeId,
      fromOutput: e.fromOutput,
      toFlowNodeId: e.toFlowNodeId,
      toInput: e.toInput,
    })),
  };
}

export async function listFlows(db: Db) {
  return db.select().from(flow).orderBy(flow.name);
}

/** The Flow as it is now, frozen into `run.flow_snapshot` at Start. */
export async function buildFlowSnapshot(db: Db, flowId: string): Promise<FlowSnapshot | null> {
  const [row] = await db.select().from(flow).where(eq(flow.id, flowId));
  if (!row) return null;
  const placements = await db.select({ placement: flowNode, node }).from(flowNode).innerJoin(node, eq(node.id, flowNode.nodeId)).where(eq(flowNode.flowId, flowId));
  const { edges } = await loadFlow(db, flowId);
  return {
    name: row.name,
    nodes: placements.map(({ placement, node: n }) => ({
      id: placement.id,
      nodeId: n.id,
      name: placement.label ?? n.name,
      kind: n.kind,
      instructions: n.instructions,
      command: n.command,
      inputs: n.inputs.filter((i) => isOutputType(i.type)) as NodeInput[],
      outputs: n.outputs.filter((o) => isOutputType(o.type)) as NodeOutput[],
      extraInstructions: placement.extraInstructions,
      enabledOptionalOutputs: placement.enabledOptionalOutputs,
      x: placement.x,
      y: placement.y,
    })),
    edges,
  };
}

export type FlowLock = { runId: string; state: (typeof run.$inferSelect)["state"] };

/**
 * The Flows locked by an Active Run, Dry-run included (FLW-7): the oldest such
 * Run of each. A query over `run`, never a stored flag, so it cannot be left behind.
 */
export async function flowLocks(db: Db, flowIds: readonly string[]): Promise<Map<string, FlowLock>> {
  const locks = new Map<string, FlowLock>();
  if (flowIds.length === 0) return locks;
  const rows = await db
    .select({ flowId: run.flowId, runId: run.id, state: run.state })
    .from(run)
    .where(and(inArray(run.flowId, [...flowIds]), notInArray(run.state, ["succeeded", "cancelled"])))
    .orderBy(asc(run.queuedAt), asc(run.id));
  for (const r of rows) if (!locks.has(r.flowId)) locks.set(r.flowId, { runId: r.runId, state: r.state });
  return locks;
}

export type FlowListRow = {
  id: string;
  name: string;
  isSample: boolean;
  clonedFromId: string | null;
  updatedByEmail: string;
  updatedAt: Date;
  nodeCount: number;
};

/** Every Flow with its number of placed Nodes, for the Flows page (FLW-9). */
export async function listFlowRows(db: Db): Promise<FlowListRow[]> {
  return db
    .select({
      id: flow.id,
      name: flow.name,
      isSample: flow.isSample,
      clonedFromId: flow.clonedFromId,
      updatedByEmail: flow.updatedByEmail,
      updatedAt: flow.updatedAt,
      nodeCount: sql<number>`(select count(*)::int from flow_node where flow_node.flow_id = "flow"."id")`,
    })
    .from(flow)
    .orderBy(flow.name);
}

/**
 * Creates a new, non-sample Flow with the library's Ticket Node already placed,
 * since every Flow starts with exactly one (FLW-5). The seeded Ticket is
 * preferred; if the library has no Ticket Node the Flow starts empty.
 */
export async function createFlow(db: Db, name: string, actorEmail: string, now: Date): Promise<{ id: string; name: string }> {
  return db.transaction(async (tx) => {
    const tickets = await tx.select({ id: node.id, slug: node.slug }).from(node).where(eq(node.kind, "ticket")).orderBy(asc(node.createdAt));
    const ticket = tickets.find((t) => t.slug === "ticket") ?? tickets[0];
    const [created] = await tx.insert(flow).values({ name, isSample: false, updatedByEmail: actorEmail, updatedAt: now }).returning();
    if (ticket) await tx.insert(flowNode).values({ flowId: created!.id, nodeId: ticket.id, x: 0, y: 0 });
    return { id: created!.id, name: created!.name };
  });
}

/**
 * Copies a Flow, its placements and edges into a new non-sample Flow named
 * `<name> (copy)` (FLW-8). Library Nodes are shared, not copied.
 */
export async function cloneFlow(db: Db, flowId: string, actorEmail: string, now: Date): Promise<{ id: string; name: string } | null> {
  return db.transaction(async (tx) => {
    const [source] = await tx.select().from(flow).where(eq(flow.id, flowId));
    if (!source) return null;
    const [copy] = await tx
      .insert(flow)
      .values({ name: `${source.name} (copy)`, isSample: false, clonedFromId: source.id, updatedByEmail: actorEmail, updatedAt: now })
      .returning();
    const placements = await tx.select().from(flowNode).where(eq(flowNode.flowId, flowId));
    const ids = new Map<string, string>();
    for (const p of placements) {
      const [made] = await tx
        .insert(flowNode)
        .values({
          flowId: copy!.id,
          nodeId: p.nodeId,
          label: p.label,
          extraInstructions: p.extraInstructions,
          enabledOptionalOutputs: p.enabledOptionalOutputs,
          x: p.x,
          y: p.y,
        })
        .returning({ id: flowNode.id });
      ids.set(p.id, made!.id);
    }
    const edges = await tx.select().from(flowEdge).where(eq(flowEdge.flowId, flowId));
    for (const e of edges) {
      await tx.insert(flowEdge).values({
        flowId: copy!.id,
        fromFlowNodeId: ids.get(e.fromFlowNodeId)!,
        fromOutput: e.fromOutput,
        toFlowNodeId: ids.get(e.toFlowNodeId)!,
        toInput: e.toInput,
      });
    }
    return { id: copy!.id, name: copy!.name };
  });
}

export type DeleteFlowResult =
  | { ok: true; name: string }
  | { ok: false; reason: "not-found" | "has-runs" }
  | { ok: false; reason: "locked"; lock: FlowLock };

/**
 * Deletes a Flow (FLW-9), samples included, refused for a Flow locked by an
 * Active Run (FLW-7) and for one that has Runs in its history, since each Run
 * keeps its Flow's id. Checked here, not only in the page.
 */
export async function deleteFlow(db: Db, flowId: string): Promise<DeleteFlowResult> {
  const [row] = await db.select().from(flow).where(eq(flow.id, flowId));
  if (!row) return { ok: false, reason: "not-found" };
  const lock = (await flowLocks(db, [flowId])).get(flowId);
  if (lock) return { ok: false, reason: "locked", lock };
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(run).where(eq(run.flowId, flowId));
  if (n > 0) return { ok: false, reason: "has-runs" };
  await db.delete(flow).where(eq(flow.id, flowId));
  return { ok: true, name: row.name };
}

export type PlacementInput = {
  id: string;
  nodeId: string;
  label: string | null;
  extraInstructions: string;
  enabledOptionalOutputs: string[];
  x: number;
  y: number;
};

export type FlowGraphInput = {
  name: string;
  nodes: PlacementInput[];
  edges: { id: string; fromFlowNodeId: string; fromOutput: string; toFlowNodeId: string; toInput: string }[];
};

/** A Flow with what the editor needs beyond the domain shape: labels and extra instructions. */
export async function loadFlowDetail(db: Db, flowId: string) {
  const [row] = await db.select().from(flow).where(eq(flow.id, flowId));
  if (!row) return null;
  const nodes = await db.select().from(flowNode).where(eq(flowNode.flowId, flowId));
  const { edges } = await loadFlow(db, flowId);
  return {
    flow: { id: row.id, name: row.name, isSample: row.isSample, clonedFromId: row.clonedFromId, updatedByEmail: row.updatedByEmail, updatedAt: row.updatedAt },
    nodes: nodes.map((n) => ({
      id: n.id,
      nodeId: n.nodeId,
      label: n.label,
      extraInstructions: n.extraInstructions,
      enabledOptionalOutputs: n.enabledOptionalOutputs,
      x: n.x,
      y: n.y,
    })),
    edges,
  };
}

export type SaveFlowResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "bad-ids" }
  | { ok: false; reason: "locked"; lock: FlowLock };

/**
 * Stores a Flow's graph (FLW-3, FLW-6), samples included: a Flow locked by an
 * Active Run is refused here, on the server, not only in the editor (FLW-7). The graph
 * is saved even with problems so work is not lost (FLW-5); Start refuses it.
 */
export async function saveFlow(db: Db, flowId: string, input: FlowGraphInput, actorEmail: string, now: Date): Promise<SaveFlowResult> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(flow).where(eq(flow.id, flowId)).for("update");
    if (!row) return { ok: false, reason: "not-found" };
      const lock = (await flowLocks(tx as unknown as Db, [flowId])).get(flowId);
    if (lock) return { ok: false, reason: "locked", lock };

    // Placement ids come from the browser; one that belongs to another Flow would clash.
    const ids = input.nodes.map((n) => n.id);
    if (ids.length > 0) {
      const taken = await tx.select({ id: flowNode.id }).from(flowNode).where(and(inArray(flowNode.id, ids), ne(flowNode.flowId, flowId)));
      if (taken.length > 0) return { ok: false, reason: "bad-ids" };
    }

    await tx.delete(flowNode).where(eq(flowNode.flowId, flowId)); // edges go with them
    for (const n of input.nodes) {
      await tx.insert(flowNode).values({
        id: n.id,
        flowId,
        nodeId: n.nodeId,
        label: n.label,
        extraInstructions: n.extraInstructions,
        enabledOptionalOutputs: n.enabledOptionalOutputs,
        x: n.x,
        y: n.y,
      });
    }
    for (const e of input.edges) {
      await tx.insert(flowEdge).values({
        id: e.id,
        flowId,
        fromFlowNodeId: e.fromFlowNodeId,
        fromOutput: e.fromOutput,
        toFlowNodeId: e.toFlowNodeId,
        toInput: e.toInput,
      });
    }
    await tx.update(flow).set({ name: input.name, updatedByEmail: actorEmail, updatedAt: now }).where(eq(flow.id, flowId));
    return { ok: true };
  });
}

export type ImportFlowPlan = {
  name: string;
  /** Each Node the file uses: an existing library Node to reuse, or a new definition to create. */
  nodes: { ref: string; existingId: string | null; definition: NodeDefinition }[];
  placements: { id: string; node: string; label: string | null; extraInstructions: string; enabledOptionalOutputs: string[]; x: number; y: number }[];
  edges: { from: string; output: string; to: string; input: string }[];
};

/**
 * Creates a non-sample Flow from an imported file (issue #98), with any Nodes it needs that the
 * library lacks, in one transaction. Nothing existing is changed: only rows are added.
 */
export async function importFlow(db: Db, plan: ImportFlowPlan, actorEmail: string, now: Date): Promise<{ id: string; name: string; createdNodes: number }> {
  return db.transaction(async (tx) => {
    const nodeIds = new Map<string, string>();
    let createdNodes = 0;
    for (const n of plan.nodes) {
      if (n.existingId) {
        nodeIds.set(n.ref, n.existingId);
        continue;
      }
      const [made] = await tx.insert(node).values({ ...n.definition, isSample: false, updatedByEmail: actorEmail, updatedAt: now }).returning({ id: node.id });
      nodeIds.set(n.ref, made!.id);
      createdNodes++;
    }
    const [created] = await tx.insert(flow).values({ name: plan.name, isSample: false, updatedByEmail: actorEmail, updatedAt: now }).returning();
    const placementIds = new Map<string, string>();
    for (const p of plan.placements) {
      const [made] = await tx
        .insert(flowNode)
        .values({ flowId: created!.id, nodeId: nodeIds.get(p.node)!, label: p.label, extraInstructions: p.extraInstructions, enabledOptionalOutputs: p.enabledOptionalOutputs, x: p.x, y: p.y })
        .returning({ id: flowNode.id });
      placementIds.set(p.id, made!.id);
    }
    for (const e of plan.edges) {
      await tx.insert(flowEdge).values({ flowId: created!.id, fromFlowNodeId: placementIds.get(e.from)!, fromOutput: e.output, toFlowNodeId: placementIds.get(e.to)!, toInput: e.input });
    }
    return { id: created!.id, name: created!.name, createdNodes };
  });
}
