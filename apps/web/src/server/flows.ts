import { buildFlowFile, parseFlowFile, topologicalOrder, validateFlow, type Flow, type LibraryNode, type NodeKind } from "@clauderon/core";
import {
  cloneFlow,
  createFlow,
  deleteFlow,
  importFlow,
  listLibraryRows,
  flowLocks,
  listFlowRows,
  loadFlow,
  loadFlowDetail,
  loadLibrary,
  recordAudit,
  saveFlow,
  type FlowGraphInput,
  type FlowLock,
} from "@clauderon/db";
import type { AppDeps, Viewer } from "./deps";
import { copyName } from "../app/(app)/flows/library/library-view";

// The Flows page (spec M2 §2, FLW-7 … FLW-9) as plain functions over the
// database, so tests drive them directly and pages and actions stay thin.

/** A Flow's placements in execution order; a Flow with a cycle falls back to canvas order (top to bottom, then left to right). */
function executionOrder(graph: Flow) {
  const canvas = [...graph.nodes].sort((a, b) => a.y - b.y || a.x - b.x);
  try {
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    return topologicalOrder(graph).flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  } catch {
    return canvas;
  }
}

export type FlowView = {
  id: string;
  name: string;
  isSample: boolean;
  nodeCount: number;
  problems: number;
  /** The Nodes of the Flow in the order a Run executes them (canvas order if the Flow has a cycle). */
  nodes: { name: string; kind: NodeKind }[];
  updatedByEmail: string;
  updatedAt: Date;
  lock: FlowLock | null;
};

/** Samples and Flows, each with its Node count, problems and the Run that locks it. */
export async function viewFlows(deps: AppDeps) {
  const [rows, library] = await Promise.all([listFlowRows(deps.db), loadLibrary(deps.db)]);
  const locks = await flowLocks(
    deps.db,
    rows.map((r) => r.id),
  );
  const flows: FlowView[] = [];
  const libraryById = new Map(library.map((n) => [n.id, n]));
  for (const r of rows) {
    const graph = await loadFlow(deps.db, r.id);
    flows.push({
      id: r.id,
      name: r.name,
      isSample: r.isSample,
      nodeCount: r.nodeCount,
      problems: validateFlow(graph, library).length,
      nodes: executionOrder(graph).flatMap((n) => {
        const lib = libraryById.get(n.nodeId);
        return lib ? [{ name: lib.name, kind: lib.kind }] : [];
      }),
      updatedByEmail: r.updatedByEmail,
      updatedAt: r.updatedAt,
      lock: locks.get(r.id) ?? null,
    });
  }
  return { samples: flows.filter((f) => f.isSample), flows: flows.filter((f) => !f.isSample) };
}

export type CloneFlowResult = { ok: true; flowId: string; name: string } | { ok: false; error: string };

/** Clone (FLW-8): any Member; a locked Flow can be cloned. Audit `flow.create`. */
export async function cloneMyFlow(deps: AppDeps, viewer: Viewer, flowId: string): Promise<CloneFlowResult> {
  const copy = await cloneFlow(deps.db, flowId, viewer.email, deps.clock.now());
  if (!copy) return { ok: false, error: "That Flow no longer exists." };
  await recordAudit(deps.db, { actorEmail: viewer.email, action: "flow.create", subjectType: "flow", subjectId: copy.id, detail: { clonedFrom: flowId } });
  return { ok: true, flowId: copy.id, name: copy.name };
}

export type CreateFlowResult = { ok: true; flowId: string; name: string } | { ok: false; error: string };

/**
 * New Flow (FLW-9): any Member; it starts with the Ticket Node placed. A name already
 * taken becomes "Copy of <name>" so two Flows are not confused. Audit `flow.create`.
 */
export async function createMyFlow(deps: AppDeps, viewer: Viewer, rawName: string): Promise<CreateFlowResult> {
  const wanted = String(rawName ?? "").trim().slice(0, 120);
  if (!wanted) return { ok: false, error: "Give the Flow a name." };
  const names = (await listFlowRows(deps.db)).map((f) => f.name);
  const name = names.some((x) => x.toLowerCase() === wanted.toLowerCase()) ? copyName(wanted, names) : wanted;
  const created = await createFlow(deps.db, name, viewer.email, deps.clock.now());
  await recordAudit(deps.db, { actorEmail: viewer.email, action: "flow.create", subjectType: "flow", subjectId: created.id, detail: { name } });
  return { ok: true, flowId: created.id, name: created.name };
}

export type DeleteFlowOutcome = { ok: true } | { ok: false; error: string };

/** Delete (FLW-9): any Flow, samples included; refused for locked Flows and Flows with Runs. Audit `flow.delete`. */
export async function deleteMyFlow(deps: AppDeps, viewer: Viewer, flowId: string): Promise<DeleteFlowOutcome> {
  const result = await deleteFlow(deps.db, flowId);
  if (!result.ok) {
    switch (result.reason) {
      case "not-found":
        return { ok: false, error: "That Flow no longer exists." };
      case "locked":
        return { ok: false, error: `Locked by Run ${result.lock.runId} (${result.lock.state.replaceAll("_", " ")}). It can be deleted when that Run ends.` };
      case "has-runs":
        return { ok: false, error: "This Flow has Runs in its history, so it is kept." };
    }
  }
  await recordAudit(deps.db, { actorEmail: viewer.email, action: "flow.delete", subjectType: "flow", subjectId: flowId, detail: { name: result.name } });
  return { ok: true };
}

export type EditorData = {
  flow: { id: string; name: string; isSample: boolean };
  library: LibraryNode[];
  graph: Pick<FlowGraphInput, "nodes" | "edges">;
  lock: FlowLock | null;
  /** Locked Flows open read-only (FLW-7). */
  readOnly: boolean;
};

/** What the canvas editor opens with (spec M2 §3). */
export async function editorData(deps: AppDeps, flowId: string): Promise<EditorData | null> {
  const [detail, library] = await Promise.all([loadFlowDetail(deps.db, flowId), loadLibrary(deps.db)]);
  if (!detail) return null;
  const lock = (await flowLocks(deps.db, [flowId])).get(flowId) ?? null;
  return {
    flow: { id: detail.flow.id, name: detail.flow.name, isSample: detail.flow.isSample },
    library,
    graph: { nodes: detail.nodes, edges: detail.edges },
    lock,
    readOnly: lock !== null,
  };
}

const MAX_NODES = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Keeps only well-formed pieces of a graph sent by the browser; anything else is a bad request. */
function cleanGraph(raw: FlowGraphInput): FlowGraphInput | null {
  const name = String(raw?.name ?? "").trim().slice(0, 120);
  if (!name || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges) || raw.nodes.length > MAX_NODES || raw.edges.length > MAX_NODES * 4) return null;
  const nodes = [];
  for (const n of raw.nodes) {
    if (!UUID.test(String(n.id)) || !UUID.test(String(n.nodeId)) || !Number.isFinite(n.x) || !Number.isFinite(n.y)) return null;
    nodes.push({
      id: String(n.id),
      nodeId: String(n.nodeId),
      label: n.label ? String(n.label).slice(0, 120) : null,
      extraInstructions: String(n.extraInstructions ?? "").slice(0, 10_000),
      enabledOptionalOutputs: (Array.isArray(n.enabledOptionalOutputs) ? n.enabledOptionalOutputs : []).map(String),
      x: n.x,
      y: n.y,
    });
  }
  const placed = new Set(nodes.map((n) => n.id));
  const edges = [];
  for (const e of raw.edges) {
    if (!UUID.test(String(e.id)) || !placed.has(e.fromFlowNodeId) || !placed.has(e.toFlowNodeId)) return null;
    edges.push({ id: String(e.id), fromFlowNodeId: e.fromFlowNodeId, fromOutput: String(e.fromOutput), toFlowNodeId: e.toFlowNodeId, toInput: String(e.toInput) });
  }
  return { name, nodes, edges };
}

export type SaveFlowOutcome = { ok: true; problems: number } | { ok: false; error: string };

/**
 * Save (FLW-3, FLW-5): stores the graph even with problems, samples included,
 * but a locked Flow is refused on the server (FLW-7). Audit `flow.update`.
 */
export async function saveMyFlow(deps: AppDeps, viewer: Viewer, flowId: string, raw: FlowGraphInput): Promise<SaveFlowOutcome> {
  const graph = cleanGraph(raw);
  if (!graph) return { ok: false, error: "That Flow could not be read. Reload the page and try again." };
  const result = await saveFlow(deps.db, flowId, graph, viewer.email, deps.clock.now());
  if (!result.ok) {
    switch (result.reason) {
      case "not-found":
        return { ok: false, error: "That Flow no longer exists." };
      case "locked":
        return { ok: false, error: `Locked by Run ${result.lock.runId} (${result.lock.state.replaceAll("_", " ")}). Edit it when that Run ends.` };
      case "bad-ids":
        return { ok: false, error: "That Flow could not be read. Reload the page and try again." };
    }
  }
  const library = await loadLibrary(deps.db);
  const problems = validateFlow(await loadFlow(deps.db, flowId), library).length;
  await recordAudit(deps.db, {
    actorEmail: viewer.email,
    action: "flow.update",
    subjectType: "flow",
    subjectId: flowId,
    detail: { name: graph.name, nodes: graph.nodes.length, edges: graph.edges.length, problems },
  });
  return { ok: true, problems };
}

export type ExportFlowResult = { ok: true; filename: string; json: string } | { ok: false; error: string };

/** Export (issue #98): any Member, any Flow including samples. The file holds no ids, emails or dates. */
export async function exportMyFlow(deps: AppDeps, flowId: string): Promise<ExportFlowResult> {
  const detail = await loadFlowDetail(deps.db, flowId);
  if (!detail) return { ok: false, error: "That Flow no longer exists." };
  const library = new Map((await listLibraryRows(deps.db)).map((n) => [n.id, n]));
  const placements = [...detail.nodes]
    .sort((a, b) => a.y - b.y || a.x - b.x || (a.id < b.id ? -1 : 1))
    .flatMap((p) => {
      const n = library.get(p.nodeId);
      if (!n) return [];
      const definition = { name: n.name, kind: n.kind, instructions: n.instructions, command: n.command, inputs: n.inputs, outputs: n.outputs };
      return [{ id: p.id, definition, label: p.label, extraInstructions: p.extraInstructions, enabledOptionalOutputs: p.enabledOptionalOutputs, x: p.x, y: p.y }];
    });
  const file = buildFlowFile({ name: detail.flow.name, placements, edges: detail.edges });
  const slug = detail.flow.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "flow";
  return { ok: true, filename: slug + ".flow.json", json: JSON.stringify(file, null, 2) };
}

export type ImportFlowResult = { ok: true; flowId: string; name: string; createdNodes: number } | { ok: false; error: string };

type Definition = { name: string; kind: string; instructions: string; command: string | null; inputs: unknown; outputs: unknown };
const sameDefinition = (a: Definition, b: Definition) =>
  a.name === b.name && a.kind === b.kind && a.instructions === b.instructions && a.command === b.command && JSON.stringify(a.inputs) === JSON.stringify(b.inputs) && JSON.stringify(a.outputs) === JSON.stringify(b.outputs);

/**
 * Import (issue #98): any Member; the file is checked first and nothing is created if it fails.
 * A Node the library already has (same definition) is reused, a different Node that only shares
 * a name becomes "Copy of <name>", and a Flow whose name is taken becomes "Copy of <name>" too, so
 * nothing is overwritten. Audit `flow.create`.
 */
export async function importMyFlow(deps: AppDeps, viewer: Viewer, text: string): Promise<ImportFlowResult> {
  const [rows, flowRows] = await Promise.all([listLibraryRows(deps.db), listFlowRows(deps.db)]);
  const ticket = rows.find((n) => n.kind === "ticket" && n.isSample) ?? rows.find((n) => n.kind === "ticket") ?? null;
  const parsed = parseFlowFile(text, ticket);
  if (!parsed.ok) return parsed;

  const nodeNames = rows.map((n) => n.name);
  const nodes = parsed.flow.nodes.map((n) => {
    const same = rows.find((r) => (n.isTicket ? r.id === ticket!.id : sameDefinition(r, n.definition)));
    if (same) return { ref: n.ref, existingId: same.id, definition: n.definition };
    const clash = nodeNames.some((x) => x.toLowerCase() === n.definition.name.toLowerCase());
    const name = clash ? copyName(n.definition.name, nodeNames) : n.definition.name;
    nodeNames.push(name);
    return { ref: n.ref, existingId: null, definition: { ...n.definition, name } };
  });
  const flowNames = flowRows.map((f) => f.name);
  const name = flowNames.some((x) => x.toLowerCase() === parsed.flow.name.toLowerCase()) ? copyName(parsed.flow.name, flowNames) : parsed.flow.name;

  const created = await importFlow(deps.db, { name, nodes, placements: parsed.flow.placements, edges: parsed.flow.edges }, viewer.email, deps.clock.now());
  await recordAudit(deps.db, { actorEmail: viewer.email, action: "flow.create", subjectType: "flow", subjectId: created.id, detail: { imported: true, newNodes: created.createdNodes } });
  return { ok: true, flowId: created.id, name: created.name, createdNodes: created.createdNodes };
}
