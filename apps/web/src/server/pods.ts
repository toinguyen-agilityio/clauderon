import { checkLimits, isPodReady, overCommitted, ticketKeys } from "@clauderon/core";
import { createPod, getPod, getPodHost, listPods, listProjects, podRunCounts, queuedRuns, recordAudit, updatePodLimits, type Pod, type PodRow } from "@clauderon/db";
import type { AppDeps, Viewer } from "./deps";

// Pods (spec M1 §2) as plain functions over the database, so tests drive
// them directly and pages and actions stay thin.

export type QueueEntry = { runId: string; mode: "real" | "dry"; queuedAt: Date; ticketTitle: string; flowName: string; position: number; key: string };
export type PodView = PodRow & { ready: boolean; mine: boolean; tokenRepos: string[]; queue: QueueEntry[] };

const view = (pod: PodRow, viewer: Viewer): Omit<PodView, "queue"> => ({
  ...pod,
  ready: isPodReady(pod),
  mine: pod.memberId === viewer.id,
  tokenRepos: pod.ghTokenScope?.tokenRepos ?? [],
});

/** The Pods page (POD-4): the Pod Host card with every Pod and the over-commit warning. */
export async function viewPods(deps: AppDeps, viewer: Viewer) {
  const [host, rows, projects] = await Promise.all([getPodHost(deps.db), listPods(deps.db), listProjects(deps.db)]);
  const [queues, keyOf] = [await queuedRuns(deps.db, rows.map((p) => p.id)), ticketKeys(projects)];
  const pods = rows.map((p) => ({
    ...view(p, viewer),
    // Queued Runs in start order, for the Pod row's queue (spec M2 §6).
    queue: (queues.get(p.id) ?? []).map((q, i) => ({ ...q, position: i + 1, key: keyOf(q.projectId, q.ticketNumber) })),
  }));
  return {
    host,
    ceiling: deps.limitCeiling,
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

export type SetLimitsResult = { ok: true } | { ok: false; error: string };

/**
 * Edit Slots, CPU and RAM on my Pod (POD-2, POD-6): the owner's only, each
 * capped by `POD_LIMIT_CEILING`. Slots apply at once (the scheduler runs;
 * lowering them stops nothing that is running); CPU and RAM wait for Recreate.
 */
export async function setMyPodLimits(
  deps: AppDeps,
  viewer: Viewer,
  podId: string,
  requested: { slots: unknown; cpus: unknown; memoryMb: unknown },
): Promise<SetLimitsResult | "not-found"> {
  const pod = await ownPod(deps, viewer, podId);
  if (!pod) return "not-found";
  const checked = checkLimits(requested, deps.limitCeiling);
  if (!checked.ok) return checked;
  await updatePodLimits(deps.db, podId, checked.limits);
  await recordAudit(deps.db, {
    actorEmail: viewer.email,
    action: "pod.limits",
    subjectType: "pod",
    subjectId: podId,
    detail: { from: { slots: pod.slots, cpus: pod.cpus, memoryMb: pod.memoryMb }, to: checked.limits },
  });
  await deps.command({ type: "schedule", podId });
  return { ok: true };
}
