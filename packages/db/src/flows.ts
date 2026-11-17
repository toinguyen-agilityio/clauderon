import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { NODE_KINDS, OUTPUT_TYPES, type Flow, type FlowSnapshot, type LibraryNode, type NodeInput, type NodeOutput } from "@clauderon/core";
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
  | { ok: false; reason: "not-found" | "sample" | "has-runs" }
  | { ok: false; reason: "locked"; lock: FlowLock };

/**
 * Deletes a Flow (FLW-9), refused for samples (FLW-8), for a Flow locked by an
 * Active Run (FLW-7) and for one that has Runs in its history, since each Run
 * keeps its Flow's id. Checked here, not only in the page.
 */
export async function deleteFlow(db: Db, flowId: string): Promise<DeleteFlowResult> {
  const [row] = await db.select().from(flow).where(eq(flow.id, flowId));
  if (!row) return { ok: false, reason: "not-found" };
  if (row.isSample) return { ok: false, reason: "sample" };
  const lock = (await flowLocks(db, [flowId])).get(flowId);
  if (lock) return { ok: false, reason: "locked", lock };
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(run).where(eq(run.flowId, flowId));
  if (n > 0) return { ok: false, reason: "has-runs" };
  await db.delete(flow).where(eq(flow.id, flowId));
  return { ok: true, name: row.name };
}
