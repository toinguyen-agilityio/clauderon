import { and, desc, eq, inArray, ne, notExists, sql } from "drizzle-orm";
import { diffFlow, libraryChanges, maskSnapshot, type FlowChange, type FlowVersionKind, type NodeDefinition, type VersionSnapshot } from "@clauderon/core";
import type { Db } from "./client";
import { flowLocks, type FlowLock } from "./flows";
import { flow, flowEdge, flowNode, flowVersion, node, type FlowVersionDetail } from "./schema";

// Flow history (issue #181): a full, masked snapshot per change, kept forever, with a
// summary worked out when it is stored. Written in the transaction of the change itself.

export type FlowVersionRow = typeof flowVersion.$inferSelect;

/** The Flow as it is now, in the shape a version stores (not yet masked). Null when the Flow is gone. */
export async function buildVersionSnapshot(db: Db, flowId: string): Promise<VersionSnapshot | null> {
  const [row] = await db.select().from(flow).where(eq(flow.id, flowId));
  if (!row) return null;
  const placements = await db
    .select({ placement: flowNode, node })
    .from(flowNode)
    .innerJoin(node, eq(node.id, flowNode.nodeId))
    .where(eq(flowNode.flowId, flowId))
    .orderBy(flowNode.createdAt, flowNode.id);
  const edges = await db.select().from(flowEdge).where(eq(flowEdge.flowId, flowId)).orderBy(flowEdge.createdAt, flowEdge.id);
  return {
    name: row.name,
    nodes: placements.map(({ placement: p, node: n }) => ({
      id: p.id,
      nodeId: n.id,
      label: p.label,
      definition: { name: n.name, kind: n.kind, instructions: n.instructions, command: n.command, inputs: n.inputs as NodeDefinition["inputs"], outputs: n.outputs as NodeDefinition["outputs"] },
      extraInstructions: p.extraInstructions,
      enabledOptionalOutputs: p.enabledOptionalOutputs,
      x: p.x,
      y: p.y,
    })),
    edges: edges.map((e) => ({ id: e.id, fromFlowNodeId: e.fromFlowNodeId, fromOutput: e.fromOutput, toFlowNodeId: e.toFlowNodeId, toInput: e.toInput })),
  };
}

export type RecordVersion = { flowId: string; kind: FlowVersionKind; actorEmail: string; now: Date; detail?: FlowVersionDetail };

/**
 * Stores the Flow's current state as its next version, diffed against the previous one. Called inside
 * the caller's transaction, after the Flow row is locked, so versions are numbered without gaps and a
 * failed change leaves none. An `update` or `library-node` that changed nothing records nothing (null).
 */
export async function recordFlowVersion(db: Db, input: RecordVersion): Promise<{ id: string; seq: number } | null> {
  const current = await buildVersionSnapshot(db, input.flowId);
  if (!current) return null;
  const snapshot = maskSnapshot(current);
  const [previous] = await db.select().from(flowVersion).where(eq(flowVersion.flowId, input.flowId)).orderBy(desc(flowVersion.seq)).limit(1);

  let summary: FlowChange[];
  switch (input.kind) {
    case "create":
    case "clone":
    case "import":
    case "delete":
      summary = [];
      break;
    case "baseline":
      summary = [{ type: "baseline" }];
      break;
    default: {
      // Without an earlier version there is nothing to compare with.
      const changes = previous ? diffFlow(previous.snapshot, snapshot) : [{ type: "unknown" } as FlowChange];
      summary = input.kind === "library-node" ? libraryChanges(changes) : changes;
      if (summary.length === 0 && input.kind !== "restore") return null;
    }
  }

  const seq = (previous?.seq ?? 0) + 1;
  const [row] = await db
    .insert(flowVersion)
    .values({ flowId: input.flowId, seq, kind: input.kind, actorEmail: input.actorEmail, at: input.now, flowName: snapshot.name, snapshot, summary, detail: input.detail ?? {} })
    .returning({ id: flowVersion.id });
  return { id: row!.id, seq };
}

export type FlowHistoryEntry = Omit<FlowVersionRow, "snapshot"> & { actorName: string | null };

/** A Flow's versions, newest first; works for a deleted Flow too. */
export async function listFlowHistory(db: Db, flowId: string): Promise<FlowHistoryEntry[]> {
  return db
    .select({
      id: flowVersion.id,
      flowId: flowVersion.flowId,
      seq: flowVersion.seq,
      kind: flowVersion.kind,
      actorEmail: flowVersion.actorEmail,
      at: flowVersion.at,
      flowName: flowVersion.flowName,
      summary: flowVersion.summary,
      detail: flowVersion.detail,
      actorName: sql<string | null>`(select member.name from member where member.email = ${flowVersion.actorEmail})`,
    })
    .from(flowVersion)
    .where(eq(flowVersion.flowId, flowId))
    .orderBy(desc(flowVersion.seq));
}

/** One version and the one before it, for the before and after view. Snapshots are masked again here. */
export async function getFlowVersion(db: Db, flowId: string, versionId: string): Promise<{ version: FlowVersionRow; previous: FlowVersionRow | null } | null> {
  const [version] = await db.select().from(flowVersion).where(and(eq(flowVersion.id, versionId), eq(flowVersion.flowId, flowId)));
  if (!version) return null;
  const [previous] = await db.select().from(flowVersion).where(and(eq(flowVersion.flowId, flowId), eq(flowVersion.seq, version.seq - 1)));
  return {
    version: { ...version, snapshot: maskSnapshot(version.snapshot) },
    previous: previous ? { ...previous, snapshot: maskSnapshot(previous.snapshot) } : null,
  };
}

export type DeletedFlow = { flowId: string; name: string; versionId: string; deletedByEmail: string; deletedByName: string | null; deletedAt: Date };

/** Flows that no longer exist, newest deletion first, with who deleted them. Their history stays reachable. */
export async function listDeletedFlows(db: Db): Promise<DeletedFlow[]> {
  const latest = await db
    .selectDistinctOn([flowVersion.flowId], {
      flowId: flowVersion.flowId,
      versionId: flowVersion.id,
      kind: flowVersion.kind,
      name: flowVersion.flowName,
      email: flowVersion.actorEmail,
      at: flowVersion.at,
      actorName: sql<string | null>`(select member.name from member where member.email = ${flowVersion.actorEmail})`,
    })
    .from(flowVersion)
    .where(notExists(db.select({ one: sql`1` }).from(flow).where(eq(flow.id, flowVersion.flowId))))
    .orderBy(flowVersion.flowId, desc(flowVersion.seq));
  return latest
    .filter((r) => r.kind === "delete")
    .map((r) => ({ flowId: r.flowId, name: r.name, versionId: r.versionId, deletedByEmail: r.email, deletedByName: r.actorName, deletedAt: r.at }))
    .sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
}

/** Whether a Flow with this id exists now (history can outlive it). */
export async function flowExists(db: Db, flowId: string): Promise<boolean> {
  const [row] = await db.select({ id: flow.id }).from(flow).where(eq(flow.id, flowId));
  return Boolean(row);
}

/** "Copy of X", then "Copy of X (2)"…, the first not in `existing`; at most 120 characters. */
export function copyOfName(name: string, existing: readonly string[]): string {
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()));
  const fit = (base: string, suffix: string) => `${base.slice(0, 120 - suffix.length)}${suffix}`;
  const base = `Copy of ${name.trim()}`;
  let candidate = fit(base, "");
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = fit(base, ` (${n})`);
  return candidate;
}

/**
 * The library Node each placement of a snapshot stands for: the one that still exists, or a new one made
 * from the stored definition (a name that is taken becomes "Copy of …", as in an import).
 */
async function resolveLibraryNodes(tx: Db, snapshot: VersionSnapshot, actorEmail: string, now: Date): Promise<Map<string, string>> {
  const wanted = [...new Set(snapshot.nodes.map((n) => n.nodeId))];
  const existing = new Set(wanted.length === 0 ? [] : (await tx.select({ id: node.id }).from(node).where(inArray(node.id, wanted))).map((r) => r.id));
  const names = (await tx.select({ name: node.name }).from(node)).map((r) => r.name);
  const ids = new Map<string, string>();
  for (const p of snapshot.nodes) {
    if (existing.has(p.nodeId)) {
      ids.set(p.nodeId, p.nodeId);
      continue;
    }
    if (ids.has(p.nodeId)) continue;
    const clash = names.some((x) => x.toLowerCase() === p.definition.name.toLowerCase());
    const name = clash ? copyOfName(p.definition.name, names) : p.definition.name;
    names.push(name);
    const [made] = await tx
      .insert(node)
      .values({ ...p.definition, name, isSample: false, updatedByEmail: actorEmail, updatedAt: now })
      .returning({ id: node.id });
    ids.set(p.nodeId, made!.id);
  }
  return ids;
}

async function insertGraph(tx: Db, flowId: string, snapshot: VersionSnapshot, libraryIds: Map<string, string>, freshIds: boolean) {
  const placementIds = new Map<string, string>();
  for (const p of snapshot.nodes) {
    const [made] = await tx
      .insert(flowNode)
      .values({
        ...(freshIds ? {} : { id: p.id }),
        flowId,
        nodeId: libraryIds.get(p.nodeId)!,
        label: p.label,
        extraInstructions: p.extraInstructions,
        enabledOptionalOutputs: p.enabledOptionalOutputs,
        x: p.x,
        y: p.y,
      })
      .returning({ id: flowNode.id });
    placementIds.set(p.id, made!.id);
  }
  for (const e of snapshot.edges) {
    await tx.insert(flowEdge).values({
      ...(freshIds ? {} : { id: e.id }),
      flowId,
      fromFlowNodeId: placementIds.get(e.fromFlowNodeId)!,
      fromOutput: e.fromOutput,
      toFlowNodeId: placementIds.get(e.toFlowNodeId)!,
      toInput: e.toInput,
    });
  }
}

export type RestoreFlowResult =
  | { ok: true; versionId: string | null }
  | { ok: false; reason: "not-found" | "bad-ids" }
  | { ok: false; reason: "locked"; lock: FlowLock };

/**
 * Makes a previous version the current Flow (issue #181). Same lock and row lock as `saveFlow`: a Flow
 * locked by an Active Run is refused (FLW-7). Like a save, it is stored even with problems (FLW-5).
 * A library Node that no longer exists is made again from the stored definition; one that still exists
 * keeps its current definition. Recorded as a `restore` version.
 */
export async function restoreFlowVersion(db: Db, flowId: string, versionId: string, actorEmail: string, now: Date): Promise<RestoreFlowResult> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(flow).where(eq(flow.id, flowId)).for("update");
    if (!row) return { ok: false, reason: "not-found" } as const;
    const [version] = await tx.select().from(flowVersion).where(and(eq(flowVersion.id, versionId), eq(flowVersion.flowId, flowId)));
    if (!version) return { ok: false, reason: "not-found" } as const;
    const lock = (await flowLocks(tx, [flowId])).get(flowId);
    if (lock) return { ok: false, reason: "locked", lock } as const;

    const snapshot = version.snapshot;
    const ids = snapshot.nodes.map((n) => n.id);
    if (ids.length > 0) {
      const taken = await tx.select({ id: flowNode.id }).from(flowNode).where(and(inArray(flowNode.id, ids), ne(flowNode.flowId, flowId)));
      if (taken.length > 0) return { ok: false, reason: "bad-ids" } as const;
    }
    const libraryIds = await resolveLibraryNodes(tx, snapshot, actorEmail, now);
    await tx.delete(flowNode).where(eq(flowNode.flowId, flowId)); // edges go with them
    await insertGraph(tx, flowId, snapshot, libraryIds, false);
    await tx.update(flow).set({ name: snapshot.name, updatedByEmail: actorEmail, updatedAt: now }).where(eq(flow.id, flowId));
    const recorded = await recordFlowVersion(tx, { flowId, kind: "restore", actorEmail, now, detail: { restoredFromVersionId: versionId } });
    return { ok: true, versionId: recorded?.id ?? null } as const;
  });
}

export type CloneVersionResult = { ok: true; id: string; name: string; versionId: string } | { ok: false; reason: "not-found" };

/** Creates a new Flow from a version, typically of a deleted Flow (issue #181). Recorded as a `clone`. */
export async function cloneFlowVersion(db: Db, flowId: string, versionId: string, actorEmail: string, now: Date): Promise<CloneVersionResult> {
  return db.transaction(async (tx) => {
    const [version] = await tx.select().from(flowVersion).where(and(eq(flowVersion.id, versionId), eq(flowVersion.flowId, flowId)));
    if (!version) return { ok: false, reason: "not-found" } as const;
    const snapshot = version.snapshot;
    const names = (await tx.select({ name: flow.name }).from(flow)).map((r) => r.name);
    const name = names.some((x) => x.toLowerCase() === snapshot.name.toLowerCase()) ? copyOfName(snapshot.name, names) : snapshot.name;
    const [created] = await tx.insert(flow).values({ name, isSample: false, updatedByEmail: actorEmail, updatedAt: now }).returning();
    const libraryIds = await resolveLibraryNodes(tx, snapshot, actorEmail, now);
    await insertGraph(tx, created!.id, snapshot, libraryIds, true);
    const recorded = await recordFlowVersion(tx, { flowId: created!.id, kind: "clone", actorEmail, now, detail: { clonedFrom: flowId, restoredFromVersionId: versionId } });
    return { ok: true, id: created!.id, name, versionId: recorded!.id } as const;
  });
}
