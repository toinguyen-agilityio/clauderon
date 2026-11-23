import { isMachineReady, queuePositions, ticketKeys, validateFlow } from "@clauderon/core";
import {
  buildFlowSnapshot,
  getMachineOfMember,
  getRun,
  getTickets,
  listFlows,
  listProjects,
  loadFlow,
  loadLibrary,
  machineRunCounts,
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
    // A Flow with Human Nodes waits for people at them (spec M3 §2).
    const needsHuman = runnable.some((n) => kinds.get(n.nodeId) === "approve" || kinds.get(n.nodeId) === "grill");
    ok.push({ id: flow.id, name: flow.name, nodes: runnable.length, needsHuman });
  }
  return ok;
}

async function keysFor(deps: AppDeps) {
  return ticketKeys(await listProjects(deps.db));
}

/** What the dialog shows: Flows, the Starter's Machine with Slots and Machine Ready, author warnings. */
export async function startDialog(deps: AppDeps, viewer: Viewer, ticketIds: readonly string[]) {
  const [flows, machine, tickets, keyOf] = await Promise.all([
    startableFlows(deps),
    getMachineOfMember(deps.db, viewer.id),
    getTickets(deps.db, ticketIds),
    keysFor(deps),
  ]);
  const counts = machine ? (await machineRunCounts(deps.db, [machine.id])).get(machine.id)! : null;
  return {
    flows,
    machine:
      machine && counts
        ? { id: machine.id, connected: machine.connected, paired: machine.tokenHash !== null, slots: machine.slots, ...counts, ready: isMachineReady(machine) }
        : null,
    // Where each new Run would land: 0 starts at once, n is the n-th waiting (spec M2 §6).
    positions: machine && counts ? queuePositions({ slots: machine.slots, ...counts }, ticketIds.length) : [],
    tickets: tickets.map((t) => ({ id: t.id, key: keyOf(t.projectId, t.number), title: t.title })),
    // Not blocking (TIC-9): the Starter decides.
    warnings: tickets
      .filter((t) => !TRUSTED.has(t.authorAssociation ?? ""))
      .map((t) => ({ ticketId: t.id, key: keyOf(t.projectId, t.number), authorAssociation: t.authorAssociation ?? "NONE" })),
  };
}

export type StartInput = { flowId: string; ticketIds: readonly string[]; extraInstructions: string };
export type StartResult = { ok: true; batchId: string; runIds: string[] } | { ok: false; error: string; machinePage?: string };

/**
 * Start (RUN-1, MEM-2): one Batch and one queued Run per Ticket on the
 * Starter's own Machine, then the Gateway schedules. It needs both
 * logins as last checked (POD-5); an offline Machine accepts the Batch and its
 * Runs wait.
 */
export async function startRuns(deps: AppDeps, viewer: Viewer, input: StartInput): Promise<StartResult> {
  const ticketIds = [...new Set(input.ticketIds)];
  if (ticketIds.length === 0) return { ok: false, error: "Select at least one Ticket." };

  const machine = await getMachineOfMember(deps.db, viewer.id);
  if (!machine?.tokenHash) return { ok: false, error: "You have no paired Machine yet.", machinePage: "/machines" };
  const machinePage = `/machines/${machine.id}`;
  const fix = "Log in on your Machine in your own terminal, then check logins on its page.";
  if (!machine.claudeLoggedIn) return { ok: false, error: `Claude Code is not logged in on your Machine. ${fix}`, machinePage };
  if (!machine.ghLoggedIn) return { ok: false, error: `gh is not logged in on your Machine. ${fix}`, machinePage };

  const flow = (await startableFlows(deps)).find((f) => f.id === input.flowId);
  if (!flow) return { ok: false, error: "Pick a Flow without problems." };
  const tickets = await getTickets(deps.db, ticketIds);
  if (tickets.length !== ticketIds.length) return { ok: false, error: "A selected Ticket no longer exists." };
  const flowSnapshot = await buildFlowSnapshot(deps.db, input.flowId);
  if (!flowSnapshot) return { ok: false, error: "Pick a Flow without problems." };

  const result = await startBatch(
    deps.db,
    { flowId: input.flowId, flowSnapshot, starter: viewer, machineId: machine.id, extraInstructions: input.extraInstructions.trim(), ticketIds },
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

  await deps.command({ type: "schedule", machineId: machine.id });
  return result;
}
