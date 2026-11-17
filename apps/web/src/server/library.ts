import { checkNodeDefinition, validateFlow } from "@clauderon/core";
import { createNode, deleteNode, listLibraryRows, loadFlow, loadLibrary, recordAudit, updateNode, type ChangeNodeResult } from "@clauderon/db";
import type { AppDeps, Viewer } from "./deps";

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
    case "sample":
      return "Sample Nodes are read-only.";
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

/** Delete (FLW-9): refused for samples, while a Flow uses it, and while a using Flow is locked. Audit `node.delete`. */
export async function deleteMyNode(deps: AppDeps, viewer: Viewer, nodeId: string): Promise<NodeOutcome> {
  const name = (await listLibraryRows(deps.db)).find((n) => n.id === nodeId)?.name;
  const result = await deleteNode(deps.db, nodeId);
  if (!result.ok) return { ok: false, error: refusal(result) };
  await recordAudit(deps.db, { actorEmail: viewer.email, action: "node.delete", subjectType: "node", subjectId: nodeId, detail: { name } });
  return { ok: true, flows: 0, withProblems: 0 };
}
