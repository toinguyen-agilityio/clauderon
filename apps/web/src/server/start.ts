import { isPodReady, queuePositions, ticketKeys, validateFlow } from "@clauderon/core";
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
  const kinds = new Map(library.map((n) => [n.id, n.kind]));
  const ok = [];
  for (const flow of flows) {
    const graph = await loadFlow(deps.db, flow.id);
    if (validateFlow(graph, library).length > 0) continue;
    const runnable = graph.nodes.filter((n) => kinds.get(n.nodeId) !== "ticket");
    // Human Nodes arrive in M3: such a Flow would fail at its first one.
    const needsHuman = runnable.some((n) => kinds.get(n.nodeId) === "approve" || kinds.get(n.nodeId) === "grill");
    ok.push({ id: flow.id, name: flow.name, nodes: runnable.length, needsHuman });
  }
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
    // Where each new Run would land: 0 starts at once, n is the n-th waiting (spec M2 §6).
    positions: pod && counts ? queuePositions({ slots: pod.slots, ...counts }, ticketIds.length) : [],
    tickets: tickets.map((t) => ({ id: t.id, key: keyOf(t.projectId, t.number), title: t.title })),
    // Not blocking (TIC-9): the Starter decides.
    warnings: tickets
      .filter((t) => !TRUSTED.has(t.authorAssociation ?? ""))
      .map((t) => ({ ticketId: t.id, key: keyOf(t.projectId, t.number), authorAssociation: t.authorAssociation ?? "NONE" })),
  };
}

export type StartInput = { flowId: string; ticketIds: readonly string[]; extraInstructions: string; mode?: "real" | "dry" };
export type StartResult = { ok: true; batchId: string; runIds: string[] } | { ok: false; error: string; terminal?: string };

/**
 * Start (RUN-1, MEM-2): one Batch and one queued Run per Ticket on the
 * Starter's own Pod, then the Gateway schedules. Real mode needs both logins
 * (POD-5); a stopped Pod with both logins accepts the Batch and its Runs wait.
 * Dry-run needs a Pod but no logins (RUN-13).
 */
export async function startRuns(deps: AppDeps, viewer: Viewer, input: StartInput): Promise<StartResult> {
  const ticketIds = [...new Set(input.ticketIds)];
  if (ticketIds.length === 0) return { ok: false, error: "Select at least one Ticket." };

  const pod = await getPodOfMember(deps.db, viewer.id);
  if (!pod) return { ok: false, error: "You have no Pod yet." };
  const terminal = `/pods/${pod.id}/terminal`;
  const mode = input.mode ?? "real";
  if (mode === "real") {
    if (!pod.claudeLoggedIn) return { ok: false, error: "Claude Code is not logged in on your Pod. Log in from its terminal.", terminal };
    if (!pod.ghLoggedIn) return { ok: false, error: "gh is not logged in on your Pod. Log in from its terminal.", terminal };
  }

  const flow = (await startableFlows(deps)).find((f) => f.id === input.flowId);
  if (!flow) return { ok: false, error: "Pick a Flow without problems." };
  if (flow.needsHuman) return { ok: false, error: `${flow.name} has Human Nodes, which arrive in M3.` };
  const tickets = await getTickets(deps.db, ticketIds);
  if (tickets.length !== ticketIds.length) return { ok: false, error: "A selected Ticket no longer exists." };
  const flowSnapshot = await buildFlowSnapshot(deps.db, input.flowId);
  if (!flowSnapshot) return { ok: false, error: "Pick a Flow without problems." };

  const result = await startBatch(
    deps.db,
    { flowId: input.flowId, flowSnapshot, starter: viewer, podId: pod.id, mode, extraInstructions: input.extraInstructions.trim(), ticketIds },
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
