import { checkLimits, isPodReady, overCommitted, ticketKeys } from "@clauderon/core";
import {
  createPod,
  deletePod,
  isOperator,
  getPod,
  getPodHost,
  listPods,
  listProjects,
  podRunCounts,
  POD_DEFAULTS,
  queuedRuns,
  recordAudit,
  slotRuns,
  updatePodSettings,
  type Pod,
  type PodRow,
} from "@clauderon/db";
import type { AppDeps, Viewer } from "./deps";

// Pods (spec M1 §2) as plain functions over the database, so tests drive
// them directly and pages and actions stay thin.

export type QueueEntry = {
  runId: string;
  state: string;
  mode: "real" | "dry";
  queuedAt: Date;
  startedAt: Date | null;
  ticketTitle: string;
  flowName: string;
  position: number;
  key: string;
};
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

/**
 * The Pod page: one Pod with the Runs holding its Slots and its queue.
 * Every Member can read it; only the owner gets the actions (MEM-2).
 */
export async function viewPod(deps: AppDeps, viewer: Viewer, podId: string) {
  const { host, pods, ceiling } = await viewPods(deps, viewer);
  const pod = pods.find((p) => p.id === podId);
  if (!pod) return "not-found" as const;
  const [running, projects] = await Promise.all([slotRuns(deps.db, [pod.id]), listProjects(deps.db)]);
  const keyOf = ticketKeys(projects);
  const using = (running.get(pod.id) ?? []).map((r, i) => ({ ...r, position: i + 1, key: keyOf(r.projectId, r.ticketNumber) }));
  return { pod, using, hostConnected: host?.connected === true, ceiling, canRemove: canRemovePod(deps, viewer, pod) };
}

export const POD_NAME_MAX = 60;

export type PodSettingsInput = { slots: unknown; cpus: unknown; memoryMb: unknown; name?: unknown };
type PodSettings = { name: string | null; slots: number; cpus: number; memoryMb: number };

/** Limits as `checkLimits`, plus an optional name: trimmed, empty means none. */
function checkSettings(requested: PodSettingsInput, ceiling: AppDeps["limitCeiling"]): { ok: true; settings: PodSettings } | { ok: false; error: string } {
  const name = typeof requested.name === "string" ? requested.name.trim() : "";
  if (name.length > POD_NAME_MAX) return { ok: false, error: `The name is at most ${POD_NAME_MAX} characters.` };
  const checked = checkLimits(requested, ceiling);
  if (!checked.ok) return checked;
  return { ok: true, settings: { name: name || null, ...checked.limits } };
}

/** A form's RAM is in GB; Pods store MB. Anything that is not a number stays invalid. */
export const gbToMb = (gb: unknown) => (gb === null || gb === "" ? Number.NaN : Math.round(Number(gb) * 1024));

export type CreatePodResult = { ok: true; podId: string } | { ok: false; reason: "exists" } | { ok: false; reason: "limits"; error: string };

/**
 * Create my Pod (POD-2): a `creating` row, then `pod.create`. The dialog asks
 * for its limits first (defaults 2/2/4096), each capped by the ceiling.
 */
export async function createMyPod(
  deps: AppDeps,
  viewer: Viewer,
  requested: PodSettingsInput = POD_DEFAULTS,
): Promise<CreatePodResult> {
  const checked = checkSettings(requested, deps.limitCeiling);
  if (!checked.ok) return { ok: false, reason: "limits", error: checked.error };
  const { name, ...limits } = checked.settings;
  const created = await createPod(deps.db, viewer, deps.podImage, limits, name);
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

export type RemovePodResult = { ok: true } | { ok: false; reason: "busy" };

/** Who may remove a Pod (POD-7): its owner, or an Operator cleaning up after a Member. */
export const canRemovePod = (deps: Pick<AppDeps, "operators">, viewer: Viewer, pod: { memberId: string }) =>
  pod.memberId === viewer.id || isOperator(viewer.email, deps.operators);

/**
 * Remove a Pod (POD-7): refused while it has an Active Run. The row goes at
 * once, so its owner can create a new Pod; the Host Agent then removes the
 * container and its Workspace volume, logins included.
 */
export async function removePod(deps: AppDeps, viewer: Viewer, podId: string): Promise<RemovePodResult | "not-found"> {
  const pod = await getPod(deps.db, podId);
  if (!pod || !canRemovePod(deps, viewer, pod)) return "not-found";
  const deleted = await deletePod(deps.db, podId, viewer.email);
  if (!deleted.ok) return deleted.reason === "busy" ? { ok: false, reason: "busy" } : "not-found";
  await deps.command({ type: "pod.delete", podId });
  return { ok: true };
}

/** The terminal page is the owner's only (POD-9, MEM-2). */
export async function terminalAccess(deps: AppDeps, viewer: Viewer, podId: string): Promise<{ pod: Pod } | "not-found"> {
  const pod = await ownPod(deps, viewer, podId);
  return pod ? { pod } : "not-found";
}

export type SetLimitsResult = { ok: true } | { ok: false; error: string };

/**
 * Edit the name, Slots, CPU and RAM of my Pod (POD-2, POD-6): the owner's only, each
 * capped by `POD_LIMIT_CEILING`. Slots apply at once (the scheduler runs;
 * lowering them stops nothing that is running); CPU and RAM wait for Recreate.
 */
export async function setMyPodSettings(
  deps: AppDeps,
  viewer: Viewer,
  podId: string,
  requested: PodSettingsInput,
): Promise<SetLimitsResult | "not-found"> {
  const pod = await ownPod(deps, viewer, podId);
  if (!pod) return "not-found";
  const checked = checkSettings(requested, deps.limitCeiling);
  if (!checked.ok) return checked;
  await updatePodSettings(deps.db, podId, checked.settings);
  await recordAudit(deps.db, {
    actorEmail: viewer.email,
    action: "pod.limits",
    subjectType: "pod",
    subjectId: podId,
    detail: { from: { name: pod.name, slots: pod.slots, cpus: pod.cpus, memoryMb: pod.memoryMb }, to: checked.settings },
  });
  await deps.command({ type: "schedule", podId });
  return { ok: true };
}
