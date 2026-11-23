import { buildNodeFile, checkNodeDefinition, parseNodeFile, validateFlow } from "@clauderon/core";
import { createNode, deleteNode, listLibraryRows, loadFlow, loadLibrary, recordAudit, updateNode, type ChangeNodeResult } from "@clauderon/db";
import type { AppDeps, Viewer } from "./deps";
import { copyName } from "../app/(app)/flows/library/library-view";

// The Node library page (spec M2 §4, FLW-1, FLW-9, FLW-10) as plain functions
// over the database, so tests drive them directly and pages stay thin.

/** Every library Node with the Flows that use it and which of them an Active Run locks. */
export async function viewLibrary(deps: AppDeps) {
  return listLibraryRows(deps.db);
}

export type LibraryInput = Parameters<typeof checkNodeDefinition>[0];
export type NodeOutcome = { ok: true; flows: number; withProblems: number } | { ok: false; error: string };

/** Re-validates every Flow that uses a Node: a change can give them problems (FLW-10). */
async function withProblems(deps: AppDeps, flowIds: readonly string[]): Promise<number> {
  const library = await loadLibrary(deps.db);
  let count = 0;
  for (const id of flowIds) if (validateFlow(await loadFlow(deps.db, id), library).length > 0) count++;
  return count;
}

function refusal(result: Extract<ChangeNodeResult, { ok: false }>): string {
  switch (result.reason) {
    case "not-found":
      return "That Node no longer exists.";
    case "locked":
      return `${result.flow.name} uses this Node and is locked by Run ${result.lock.runId} (${result.lock.state.replaceAll("_", " ")}). Try again when that Run ends.`;
    case "in-use":
      return `Used by ${result.flows.map((f) => f.name).join(", ")}. Take it out of ${result.flows.length === 1 ? "that Flow" : "those Flows"} first.`;
  }
}

/** Create (FLW-1, FLW-9): any Member. Audit `node.create`. */
export async function createMyNode(deps: AppDeps, viewer: Viewer, input: LibraryInput): Promise<NodeOutcome> {
  const checked = checkNodeDefinition(input);
  if (!checked.ok) return checked;
  const created = await createNode(deps.db, checked.definition, viewer.email, deps.clock.now());
  await recordAudit(deps.db, { actorEmail: viewer.email, action: "node.create", subjectType: "node", subjectId: created.id, detail: { name: checked.definition.name } });
  return { ok: true, flows: 0, withProblems: 0 };
}

/**
 * Edit (FLW-9, FLW-10): changes every Flow that uses the Node, refused while one
 * of them is locked. Says how many Flows it changed and how many now have problems.
 */
export async function updateMyNode(deps: AppDeps, viewer: Viewer, nodeId: string, input: LibraryInput): Promise<NodeOutcome> {
  const checked = checkNodeDefinition(input);
  if (!checked.ok) return checked;
  const usedBy = (await listLibraryRows(deps.db)).find((n) => n.id === nodeId)?.usedBy ?? [];
  const result = await updateNode(deps.db, nodeId, checked.definition, viewer.email, deps.clock.now());
  if (!result.ok) return { ok: false, error: refusal(result) };
  await recordAudit(deps.db, {
    actorEmail: viewer.email,
    action: "node.update",
    subjectType: "node",
    subjectId: nodeId,
    detail: { name: checked.definition.name, flows: result.flows },
  });
  return { ok: true, flows: result.flows, withProblems: await withProblems(deps, usedBy.map((u) => u.flowId)) };
}

/** Delete (FLW-9): samples included; refused while a Flow uses it, and while a using Flow is locked. Audit `node.delete`. */
export async function deleteMyNode(deps: AppDeps, viewer: Viewer, nodeId: string): Promise<NodeOutcome> {
  const name = (await listLibraryRows(deps.db)).find((n) => n.id === nodeId)?.name;
  const result = await deleteNode(deps.db, nodeId);
  if (!result.ok) return { ok: false, error: refusal(result) };
  await recordAudit(deps.db, { actorEmail: viewer.email, action: "node.delete", subjectType: "node", subjectId: nodeId, detail: { name } });
  return { ok: true, flows: 0, withProblems: 0 };
}

export type ExportNodesResult = { ok: true; filename: string; json: string } | { ok: false; error: string };

/** Export (issue #116): one or several library Nodes, samples included, to a file with no ids, emails or dates. */
export async function exportMyNodes(deps: AppDeps, nodeIds: readonly string[]): Promise<ExportNodesResult> {
  const rows = await listLibraryRows(deps.db);
  const chosen = nodeIds.map((id) => rows.find((n) => n.id === id));
  if (chosen.length === 0 || chosen.some((n) => !n)) return { ok: false, error: "That Node no longer exists." };
  const nodes = chosen.map((n) => n!);
  const file = buildNodeFile(nodes);
  const slug = (nodes.length === 1 ? nodes[0]!.name : "nodes").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "nodes";
  return { ok: true, filename: `${slug}.nodes.json`, json: JSON.stringify(file, null, 2) };
}

export type ImportNodesResult =
  | { ok: true; created: { id: string; name: string }[]; skipped: string[]; tickets: string[] }
  | { ok: false; error: string };

type Definition = { name: string; kind: string; instructions: string; command: string | null; inputs: unknown; outputs: unknown };
const sameDefinition = (a: Definition, b: Definition) =>
  a.name === b.name && a.kind === b.kind && a.instructions === b.instructions && a.command === b.command && JSON.stringify(a.inputs) === JSON.stringify(b.inputs) && JSON.stringify(a.outputs) === JSON.stringify(b.outputs);

/**
 * Import (issue #116): the whole file is checked first and nothing is created if any Node fails.
 * A Node the library already has (same definition) is skipped, a different Node that only shares a
 * name becomes "Copy of <name>", a Ticket entry is skipped; nothing is overwritten. Audit `node.create` per Node.
 */
export async function importMyNodes(deps: AppDeps, viewer: Viewer, text: string): Promise<ImportNodesResult> {
  const parsed = parseNodeFile(text);
  if (!parsed.ok) return parsed;
  const known: Definition[] = (await listLibraryRows(deps.db)).map((n) => ({ ...n }));
  const names = known.map((n) => n.name);
  const created: { id: string; name: string }[] = [];
  const skipped: string[] = [];
  for (const definition of parsed.parsed.definitions) {
    if (known.some((k) => sameDefinition(k, definition))) {
      skipped.push(definition.name);
      continue;
    }
    const clash = names.some((x) => x.toLowerCase() === definition.name.toLowerCase());
    const name = clash ? copyName(definition.name, names) : definition.name;
    names.push(name);
    const final = { ...definition, name };
    const { id } = await createNode(deps.db, final, viewer.email, deps.clock.now());
    known.push(final);
    created.push({ id, name });
    await recordAudit(deps.db, { actorEmail: viewer.email, action: "node.create", subjectType: "node", subjectId: id, detail: { name, imported: true } });
  }
  return { ok: true, created, skipped, tickets: parsed.parsed.tickets };
}

export type CloneNodeOutcome = { ok: true; id: string; name: string } | { ok: false; error: string };

/**
 * Clone a sample Node into a new editable one (same Kind, instructions, command, Inputs and
 * Outputs) named "Copy of <name>". The sample and the Flows using it are untouched. Audit `node.create`.
 */
export async function cloneMyNode(deps: AppDeps, viewer: Viewer, nodeId: string): Promise<CloneNodeOutcome> {
  const rows = await listLibraryRows(deps.db);
  const source = rows.find((n) => n.id === nodeId);
  if (!source) return { ok: false, error: "That Node no longer exists." };
  if (!source.isSample) return { ok: false, error: "Only sample Nodes can be cloned." };
  const name = copyName(source.name, rows.map((n) => n.name));
  const checked = checkNodeDefinition({ name, kind: source.kind, instructions: source.instructions, command: source.command, inputs: source.inputs, outputs: source.outputs });
  if (!checked.ok) return checked;
  const created = await createNode(deps.db, checked.definition, viewer.email, deps.clock.now());
  await recordAudit(deps.db, { actorEmail: viewer.email, action: "node.create", subjectType: "node", subjectId: created.id, detail: { name, clonedFrom: nodeId } });
  return { ok: true, id: created.id, name };
}
