import { eq } from "drizzle-orm";
import type { NodeDefinition } from "@clauderon/core";
import type { Db } from "./client";
import { flowLocks, type FlowLock } from "./flows";
import { flow, flowNode, node } from "./schema";

// The Node library (spec M2 §4, FLW-1, FLW-9, FLW-10).

export type LibraryRow = {
  id: string;
  name: string;
  kind: NodeDefinition["kind"];
  instructions: string;
  command: string | null;
  inputs: NodeDefinition["inputs"];
  outputs: NodeDefinition["outputs"];
  isSample: boolean;
  updatedByEmail: string;
  updatedAt: Date;
  /** The Flows that place this Node, each with the Run that locks it, if any. */
  usedBy: { flowId: string; name: string; lock: FlowLock | null }[];
};

/** Every library Node with the Flows that use it (FLW-9). */
export async function listLibraryRows(db: Db): Promise<LibraryRow[]> {
  const nodes = await db.select().from(node).orderBy(node.name);
  const uses = await db.select({ nodeId: flowNode.nodeId, flowId: flow.id, name: flow.name }).from(flowNode).innerJoin(flow, eq(flow.id, flowNode.flowId));
  const locks = await flowLocks(db, [...new Set(uses.map((u) => u.flowId))]);
  return nodes.map((n) => ({
    id: n.id,
    name: n.name,
    kind: n.kind,
    instructions: n.instructions,
    command: n.command,
    inputs: n.inputs as LibraryRow["inputs"],
    outputs: n.outputs as LibraryRow["outputs"],
    isSample: n.isSample,
    updatedByEmail: n.updatedByEmail,
    updatedAt: n.updatedAt,
    usedBy: [...new Map(uses.filter((u) => u.nodeId === n.id).map((u) => [u.flowId, { flowId: u.flowId, name: u.name, lock: locks.get(u.flowId) ?? null }])).values()],
  }));
}

export async function createNode(db: Db, definition: NodeDefinition, actorEmail: string, now: Date): Promise<{ id: string }> {
  const [row] = await db
    .insert(node)
    .values({ ...definition, isSample: false, updatedByEmail: actorEmail, updatedAt: now })
    .returning({ id: node.id });
  return row!;
}

export type ChangeNodeResult =
  | { ok: true; flows: number }
  | { ok: false; reason: "not-found" | "sample" }
  | { ok: false; reason: "locked"; flow: { id: string; name: string }; lock: FlowLock }
  | { ok: false; reason: "in-use"; flows: { id: string; name: string }[] };

/** The first Flow using the Node that an Active Run locks (FLW-10), if any. */
async function lockedUse(db: Db, nodeId: string) {
  const row = (await listLibraryRows(db)).find((n) => n.id === nodeId);
  const locked = row?.usedBy.find((u) => u.lock);
  return { row, locked };
}

/**
 * Edits a Node (FLW-9). It changes every Flow that uses it, so it is refused
 * while any of them is locked (FLW-10), naming the Flow and the Run; a sample
 * is refused too. Returns how many Flows it changed.
 */
export async function updateNode(db: Db, nodeId: string, definition: NodeDefinition, actorEmail: string, now: Date): Promise<ChangeNodeResult> {
  const { row, locked } = await lockedUse(db, nodeId);
  if (!row) return { ok: false, reason: "not-found" };
  if (row.isSample) return { ok: false, reason: "sample" };
  if (locked) return { ok: false, reason: "locked", flow: { id: locked.flowId, name: locked.name }, lock: locked.lock! };
  await db.update(node).set({ ...definition, updatedByEmail: actorEmail, updatedAt: now }).where(eq(node.id, nodeId));
  return { ok: true, flows: row.usedBy.length };
}

/** Deletes a Node (FLW-9): refused for a sample, a locked use (FLW-10) and any Flow that still uses it. */
export async function deleteNode(db: Db, nodeId: string): Promise<ChangeNodeResult> {
  const { row, locked } = await lockedUse(db, nodeId);
  if (!row) return { ok: false, reason: "not-found" };
  if (row.isSample) return { ok: false, reason: "sample" };
  if (locked) return { ok: false, reason: "locked", flow: { id: locked.flowId, name: locked.name }, lock: locked.lock! };
  if (row.usedBy.length > 0) return { ok: false, reason: "in-use", flows: row.usedBy.map((u) => ({ id: u.flowId, name: u.name })) };
  await db.delete(node).where(eq(node.id, nodeId));
  return { ok: true, flows: 0 };
}
