import { validateFlow } from "@clauderon/core";
import { cloneFlow, deleteFlow, flowLocks, listFlowRows, loadFlow, loadLibrary, recordAudit, type FlowLock } from "@clauderon/db";
import type { AppDeps, Viewer } from "./deps";

// The Flows page (spec M2 §2, FLW-7 … FLW-9) as plain functions over the
// database, so tests drive them directly and pages and actions stay thin.

export type FlowView = {
  id: string;
  name: string;
  isSample: boolean;
  nodeCount: number;
  problems: number;
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
  for (const r of rows) {
    const graph = await loadFlow(deps.db, r.id);
    flows.push({
      id: r.id,
      name: r.name,
      isSample: r.isSample,
      nodeCount: r.nodeCount,
      problems: validateFlow(graph, library).length,
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

export type DeleteFlowOutcome = { ok: true } | { ok: false; error: string };

/** Delete (FLW-9): refused for samples, locked Flows and Flows with Runs. Audit `flow.delete`. */
export async function deleteMyFlow(deps: AppDeps, viewer: Viewer, flowId: string): Promise<DeleteFlowOutcome> {
  const result = await deleteFlow(deps.db, flowId);
  if (!result.ok) {
    switch (result.reason) {
      case "not-found":
        return { ok: false, error: "That Flow no longer exists." };
      case "sample":
        return { ok: false, error: "Sample Flows cannot be deleted. Clone one to change it." };
      case "locked":
        return { ok: false, error: `Locked by Run ${result.lock.runId} (${result.lock.state.replaceAll("_", " ")}). It can be deleted when that Run ends.` };
      case "has-runs":
        return { ok: false, error: "This Flow has Runs in its history, so it is kept." };
    }
  }
  await recordAudit(deps.db, { actorEmail: viewer.email, action: "flow.delete", subjectType: "flow", subjectId: flowId, detail: { name: result.name } });
  return { ok: true };
}
