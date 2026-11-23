import { checkSlots, formatPairingCode, isMachineReady, normalizePairingCode, ticketKeys } from "@clauderon/core";
import {
  approvePairing,
  deleteMachine,
  findPendingPairing,
  getMachine,
  getMachineOfMember,
  isOperator,
  listMachines,
  listProjects,
  queuedRuns,
  recordAudit,
  slotRuns,
  unpairMachine,
  updateMachineSettings,
  type Machine,
  type MachineRow,
} from "@clauderon/db";
import type { AppDeps, Viewer } from "./deps";

// Machines (ADR 0006) as plain functions over the database, so tests drive
// them directly and pages and actions stay thin.

export type QueueEntry = {
  runId: string;
  state: string;
  queuedAt: Date;
  startedAt: Date | null;
  ticketTitle: string;
  flowName: string;
  position: number;
  key: string;
};
export type MachineView = MachineRow & { paired: boolean; ready: boolean; mine: boolean; tokenRepos: string[]; queue: QueueEntry[] };

const view = (machine: MachineRow, viewer: Viewer): Omit<MachineView, "queue"> => ({
  ...machine,
  paired: machine.tokenHash !== null,
  ready: isMachineReady(machine),
  mine: machine.memberId === viewer.id,
  tokenRepos: machine.ghTokenScope?.tokenRepos ?? [],
});

/** The Machines page: every Member's Machine, the viewer's first. */
export async function viewMachines(deps: AppDeps, viewer: Viewer) {
  const [rows, projects] = await Promise.all([listMachines(deps.db), listProjects(deps.db)]);
  const [queues, keyOf] = [await queuedRuns(deps.db, rows.map((m) => m.id)), ticketKeys(projects)];
  const machines = rows.map((m) => ({
    ...view(m, viewer),
    // Queued Runs in start order (spec M2 §6).
    queue: (queues.get(m.id) ?? []).map((q, i) => ({ ...q, position: i + 1, key: keyOf(q.projectId, q.ticketNumber) })),
  }));
  return { machines, mine: machines.find((m) => m.mine) ?? null };
}

/**
 * The Machine page: one Machine with the Runs holding its Slots and its
 * queue. Every Member can read it; only the owner gets the actions (MEM-2).
 */
export async function viewMachine(deps: AppDeps, viewer: Viewer, machineId: string) {
  const { machines } = await viewMachines(deps, viewer);
  const machine = machines.find((m) => m.id === machineId);
  if (!machine) return "not-found" as const;
  const [running, projects] = await Promise.all([slotRuns(deps.db, [machine.id]), listProjects(deps.db)]);
  const keyOf = ticketKeys(projects);
  const using = (running.get(machine.id) ?? []).map((r, i) => ({ ...r, position: i + 1, key: keyOf(r.projectId, r.ticketNumber) }));
  return { machine, using, canRemove: canRemoveMachine(deps, viewer, machine) };
}

export type PairingPreview = { code: string; hostname: string; os: string; arch: string; expiresAt: Date; replaces: string | null };
export type LookUpResult = { ok: true; pairing: PairingPreview } | { ok: false; error: string };

const NO_SUCH_CODE = "No pairing waits for that code. Check it, or run pair again on the computer: codes last 10 minutes.";

/** Shows which computer a code belongs to before the Member approves it (ADR 0006). */
export async function lookUpPairing(deps: AppDeps, viewer: Viewer, code: string): Promise<LookUpResult> {
  const pending = await findPendingPairing(deps.db, code, deps.clock.now());
  if (!pending) return { ok: false, error: NO_SUCH_CODE };
  const current = await getMachineOfMember(deps.db, viewer.id);
  return {
    ok: true,
    pairing: {
      code: formatPairingCode(pending.code),
      hostname: pending.hostname,
      os: pending.os,
      arch: pending.arch,
      expiresAt: pending.expiresAt,
      replaces: current?.tokenHash ? (current.hostname ?? "your current Machine") : null,
    },
  };
}

export type ApproveResult = { ok: true; machineId: string } | { ok: false; error: string };

/**
 * Approve a pairing code (ADR 0006): the computer showing it becomes the
 * viewer's Machine. A Machine paired before is replaced: its old Agent is
 * disconnected and its Running Runs become Interrupted.
 */
export async function approveMyPairing(deps: AppDeps, viewer: Viewer, code: string): Promise<ApproveResult> {
  if (normalizePairingCode(code).length === 0) return { ok: false, error: "Enter the code the Agent shows." };
  const result = await approvePairing(deps.db, viewer, code, deps.clock.now());
  if (!result.ok) return { ok: false, error: NO_SUCH_CODE };
  if (result.replaced) await deps.command({ type: "machine.repaired", machineId: result.machine.id });
  return { ok: true, machineId: result.machine.id };
}

/** The viewer's own Machine, or null: other Members' Machines read as not found (MEM-2). */
async function ownMachine(deps: AppDeps, viewer: Viewer, machineId: string): Promise<Machine | null> {
  const machine = await getMachine(deps.db, machineId);
  return machine && machine.memberId === viewer.id ? machine : null;
}

/** Check logins now (POD-5): the owner's only; the Agent answers once it is connected. */
export async function checkMyLogins(deps: AppDeps, viewer: Viewer, machineId: string): Promise<{ ok: true } | "not-found"> {
  if (!(await ownMachine(deps, viewer, machineId))) return "not-found";
  await deps.command({ type: "machine.checkLogins", machineId });
  return { ok: true };
}

export const MACHINE_NAME_MAX = 60;

export type MachineSettingsInput = { name?: unknown; slots: unknown };
export type SettingsResult = { ok: true } | { ok: false; error: string };

/**
 * Edit the name and Slots of my Machine (ADR 0006): the owner's only. Slots
 * apply at once: the scheduler runs, and lowering them stops nothing running.
 */
export async function setMyMachineSettings(
  deps: AppDeps,
  viewer: Viewer,
  machineId: string,
  requested: MachineSettingsInput,
): Promise<SettingsResult | "not-found"> {
  const machine = await ownMachine(deps, viewer, machineId);
  if (!machine) return "not-found";
  const name = typeof requested.name === "string" ? requested.name.trim() : "";
  if (name.length > MACHINE_NAME_MAX) return { ok: false, error: `The name is at most ${MACHINE_NAME_MAX} characters.` };
  const slots = checkSlots(requested.slots);
  if (!slots.ok) return slots;
  const settings = { name: name || null, slots: slots.slots };
  await updateMachineSettings(deps.db, machineId, settings);
  await recordAudit(deps.db, {
    actorEmail: viewer.email,
    action: "machine.settings",
    subjectType: "machine",
    subjectId: machineId,
    detail: { from: { name: machine.name, slots: machine.slots }, to: settings },
  });
  await deps.command({ type: "schedule", machineId });
  return { ok: true };
}

/**
 * Unpair my Machine (ADR 0006): its token stops working at once, its Agent is
 * disconnected and its Running Runs become Interrupted. Slots, queue and
 * history stay for the next Pairing.
 */
export async function unpairMyMachine(deps: AppDeps, viewer: Viewer, machineId: string): Promise<{ ok: true } | "not-found"> {
  if (!(await ownMachine(deps, viewer, machineId))) return "not-found";
  await unpairMachine(deps.db, machineId, viewer.email);
  await deps.command({ type: "machine.repaired", machineId });
  return { ok: true };
}

/** Who may remove a Machine: its owner, or an Operator cleaning up after a Member. */
export const canRemoveMachine = (deps: Pick<AppDeps, "operators">, viewer: Viewer, machine: { memberId: string }) =>
  machine.memberId === viewer.id || isOperator(viewer.email, deps.operators);

export type RemoveResult = { ok: true } | { ok: false; reason: "busy" };

/**
 * Remove a Machine: refused while it has an Active Run. The row goes at once,
 * so its owner can pair again from scratch; the Agent is disconnected. The
 * Agent's directory on the computer is left for its owner to delete.
 */
export async function removeMachine(deps: AppDeps, viewer: Viewer, machineId: string): Promise<RemoveResult | "not-found"> {
  const machine = await getMachine(deps.db, machineId);
  if (!machine || !canRemoveMachine(deps, viewer, machine)) return "not-found";
  const deleted = await deleteMachine(deps.db, machineId, viewer.email);
  if (!deleted.ok) return deleted.reason === "busy" ? { ok: false, reason: "busy" } : "not-found";
  await deps.command({ type: "machine.repaired", machineId });
  return { ok: true };
}
