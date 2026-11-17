import { isPodReady, overCommitted } from "@clauderon/core";
import { createPod, getPod, getPodHost, listPods, podRunCounts, recordAudit, type Pod, type PodRow } from "@clauderon/db";
import type { AppDeps, Viewer } from "./deps";

// Pods (spec M1 §2) as plain functions over the database, so tests drive
// them directly and pages and actions stay thin.

export type PodView = PodRow & { ready: boolean; mine: boolean; tokenRepos: string[] };

const view = (pod: PodRow, viewer: Viewer): PodView => ({
  ...pod,
  ready: isPodReady(pod),
  mine: pod.memberId === viewer.id,
  tokenRepos: pod.ghTokenScope?.tokenRepos ?? [],
});

/** The Pods page (POD-4): the Pod Host card with every Pod and the over-commit warning. */
export async function viewPods(deps: AppDeps, viewer: Viewer) {
  const [host, rows] = await Promise.all([getPodHost(deps.db), listPods(deps.db)]);
  const pods = rows.map((p) => view(p, viewer));
  return {
    host,
    pods,
    mine: pods.find((p) => p.mine) ?? null,
    limits: { cpus: rows.reduce((s, p) => s + p.cpus, 0), memoryMb: rows.reduce((s, p) => s + p.memoryMb, 0) },
    overCommitted: overCommitted(host, rows),
  };
}

export type CreatePodResult = { ok: true; podId: string } | { ok: false; reason: "exists" };

/** Create my Pod (POD-2): a `creating` row with the defaults, then `pod.create`. */
export async function createMyPod(deps: AppDeps, viewer: Viewer): Promise<CreatePodResult> {
  const created = await createPod(deps.db, viewer, deps.podImage);
  if (!created.ok) return created;
  await deps.command({ type: "pod.create", podId: created.pod.id });
  return { ok: true, podId: created.pod.id };
}

/** The viewer's own Pod, or null: other Members' Pods read as not found (MEM-2). */
async function ownPod(deps: AppDeps, viewer: Viewer, podId: string): Promise<Pod | null> {
  const pod = await getPod(deps.db, podId);
  return pod && pod.memberId === viewer.id ? pod : null;
}

export type PodAction = "start" | "stop" | "refresh";

export type PodActionResult = { ok: true } | { ok: false; reason: "busy" };

/**
 * Start, Stop and Refresh (POD-6, POD-5): the owner's only; others get 404.
 * Stop is refused while the Pod has Running or Waiting Runs.
 */
export async function podAction(deps: AppDeps, viewer: Viewer, podId: string, action: PodAction): Promise<PodActionResult | "not-found"> {
  if (!(await ownPod(deps, viewer, podId))) return "not-found";
  if (action === "refresh") {
    await deps.command({ type: "pod.checkLogins", podId });
    return { ok: true };
  }
  if (action === "stop" && (await podRunCounts(deps.db, [podId])).get(podId)!.inUse > 0) return { ok: false, reason: "busy" };
  await recordAudit(deps.db, { actorEmail: viewer.email, action: `pod.${action}`, subjectType: "pod", subjectId: podId });
  await deps.command({ type: action === "start" ? "pod.start" : "pod.stop", podId });
  return { ok: true };
}

/** The terminal page is the owner's only (POD-9, MEM-2). */
export async function terminalAccess(deps: AppDeps, viewer: Viewer, podId: string): Promise<{ pod: Pod } | "not-found"> {
  const pod = await ownPod(deps, viewer, podId);
  return pod ? { pod } : "not-found";
}
