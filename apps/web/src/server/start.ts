import { isPodReady, ticketKeys, validateFlow } from "@clauderon/core";
import {
  buildFlowSnapshot,
  getPodOfMember,
  getRun,
  getTickets,
  listFlows,
  listProjects,
  loadFlow,
  loadLibrary,
  podRunCounts,
  startBatch,
} from "@clauderon/db";
import type { AppDeps, Viewer } from "./deps";

// The Start dialog and Batch creation (spec M1 §4.1).

const TRUSTED = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

/** Flows without problems (RUN-1): only those can start Runs. */
async function startableFlows(deps: AppDeps) {
  const [flows, library] = await Promise.all([listFlows(deps.db), loadLibrary(deps.db)]);
  const ok = [];
  for (const flow of flows) if (validateFlow(await loadFlow(deps.db, flow.id), library).length === 0) ok.push({ id: flow.id, name: flow.name });
  return ok;
}

async function keysFor(deps: AppDeps) {
  return ticketKeys(await listProjects(deps.db));
}

/** What the dialog shows: Flows, the Starter's Pod with Slots and Pod Ready, author warnings. */
export async function startDialog(deps: AppDeps, viewer: Viewer, ticketIds: readonly string[]) {
  const [flows, pod, tickets, keyOf] = await Promise.all([startableFlows(deps), getPodOfMember(deps.db, viewer.id), getTickets(deps.db, ticketIds), keysFor(deps)]);
  const counts = pod ? (await podRunCounts(deps.db, [pod.id])).get(pod.id)! : null;
  return {
    flows,
    pod: pod && counts ? { id: pod.id, status: pod.status, slots: pod.slots, ...counts, ready: isPodReady(pod) } : null,
    tickets: tickets.map((t) => ({ id: t.id, key: keyOf(t.projectId, t.number), title: t.title })),
    // Not blocking (TIC-9): the Starter decides.
    warnings: tickets
      .filter((t) => !TRUSTED.has(t.authorAssociation ?? ""))
      .map((t) => ({ ticketId: t.id, key: keyOf(t.projectId, t.number), authorAssociation: t.authorAssociation ?? "NONE" })),
  };
}

export type StartInput = { flowId: string; ticketIds: readonly string[]; extraInstructions: string };
export type StartResult = { ok: true; batchId: string; runIds: string[] } | { ok: false; error: string; terminal?: string };

/**
 * Start (RUN-1, MEM-2): one Batch and one queued Run per Ticket on the
 * Starter's own Pod, then the Gateway schedules. Real mode needs both logins
 * (POD-5); a stopped Pod with both logins accepts the Batch and its Runs wait.
 */
export async function startRuns(deps: AppDeps, viewer: Viewer, input: StartInput): Promise<StartResult> {
  const ticketIds = [...new Set(input.ticketIds)];
  if (ticketIds.length === 0) return { ok: false, error: "Select at least one Ticket." };

  const pod = await getPodOfMember(deps.db, viewer.id);
  if (!pod) return { ok: false, error: "You have no Pod yet." };
  const terminal = `/pods/${pod.id}/terminal`;
  if (!pod.claudeLoggedIn) return { ok: false, error: "Claude Code is not logged in on your Pod. Log in from its terminal.", terminal };
  if (!pod.ghLoggedIn) return { ok: false, error: "gh is not logged in on your Pod. Log in from its terminal.", terminal };

  if (!(await startableFlows(deps)).some((f) => f.id === input.flowId)) return { ok: false, error: "Pick a Flow without problems." };
  const tickets = await getTickets(deps.db, ticketIds);
  if (tickets.length !== ticketIds.length) return { ok: false, error: "A selected Ticket no longer exists." };
  const flowSnapshot = await buildFlowSnapshot(deps.db, input.flowId);
  if (!flowSnapshot) return { ok: false, error: "Pick a Flow without problems." };

  const result = await startBatch(
    deps.db,
    { flowId: input.flowId, flowSnapshot, starter: viewer, podId: pod.id, mode: "real", extraInstructions: input.extraInstructions.trim(), ticketIds },
    deps.clock.now(),
  );
  if (!result.ok) {
    const keyOf = await keysFor(deps);
    const ticket = tickets.find((t) => t.id === result.ticketId);
    const active = result.runId ? await getRun(deps.db, result.runId) : null;
    const key = ticket ? keyOf(ticket.projectId, ticket.number) : "A Ticket";
    const where = active ? ` (${active.state}): /runs/${active.id}` : "";
    return { ok: false, error: `${key} already has an Active Run${where}` };
  }

  await deps.command({ type: "schedule", podId: pod.id });
  return result;
}
