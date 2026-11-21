import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
import type { Db } from "./client";
import { recordAudit } from "./access";
import { flow, machine, member, run, ticket, type MachineDoctor, type MachineUsage } from "./schema";

export type { MachineDoctor, MachineUsage } from "./schema";

// Machines (ADR 0006): one per Member, created by its first Pairing.

export type Machine = typeof machine.$inferSelect;
export const MACHINE_DEFAULT_SLOTS = 2;

export async function getMachine(db: Db, id: string): Promise<Machine | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(machine).where(eq(machine.id, id));
  return row ?? null;
}

export async function getMachineOfMember(db: Db, memberId: string): Promise<Machine | null> {
  const [row] = await db.select().from(machine).where(eq(machine.memberId, memberId));
  return row ?? null;
}

export type MachineRunCounts = { inUse: number; queued: number };

/** Slots in use (Running or Waiting) and queue length per Machine. */
export async function machineRunCounts(db: Db, machineIds: readonly string[]): Promise<Map<string, MachineRunCounts>> {
  const counts = new Map<string, MachineRunCounts>(machineIds.map((id) => [id, { inUse: 0, queued: 0 }]));
  if (machineIds.length === 0) return counts;
  const rows = await db
    .select({ machineId: run.machineId, state: run.state, n: sql<number>`count(*)::int` })
    .from(run)
    .where(and(inArray(run.machineId, [...machineIds]), inArray(run.state, ["queued", "running", "waiting_for_human"])))
    .groupBy(run.machineId, run.state);
  for (const r of rows) {
    const c = counts.get(r.machineId!)!;
    if (r.state === "queued") c.queued += r.n;
    else c.inUse += r.n;
  }
  return counts;
}

/** Active Runs (anything not Succeeded or Cancelled) per Machine; they block removing it. */
export async function machineActiveRuns(db: Db, machineIds: readonly string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>(machineIds.map((id) => [id, 0]));
  if (machineIds.length === 0) return counts;
  const rows = await db
    .select({ machineId: run.machineId, n: sql<number>`count(*)::int` })
    .from(run)
    .where(and(inArray(run.machineId, [...machineIds]), notInArray(run.state, ["succeeded", "cancelled"])))
    .groupBy(run.machineId);
  for (const r of rows) counts.set(r.machineId!, r.n);
  return counts;
}

export type MachineRow = Machine & { owner: { email: string; name: string | null; pictureUrl: string | null } } & MachineRunCounts;

/** Every Machine with its owner, Slots in use and queue, for the Machines page. */
export async function listMachines(db: Db): Promise<MachineRow[]> {
  const rows = await db
    .select({ machine, owner: { email: member.email, name: member.name, pictureUrl: member.pictureUrl } })
    .from(machine)
    .innerJoin(member, eq(member.id, machine.memberId))
    .orderBy(asc(member.email));
  const counts = await machineRunCounts(
    db,
    rows.map((r) => r.machine.id),
  );
  return rows.map((r) => ({ ...r.machine, owner: r.owner, ...counts.get(r.machine.id)! }));
}

export type MachineLogins = {
  machineId: string;
  claude: boolean;
  gh: boolean;
  ghAccount: string | null;
  claudeAccount?: string | null;
  claudePlan?: string | null;
  tokenRepos: string[];
  checkedAt: Date;
};

/** Applies a `machine.logins` from the Agent (POD-5). */
export async function applyMachineLogins(db: Db, logins: MachineLogins): Promise<Machine | null> {
  const [row] = await db
    .update(machine)
    .set({
      claudeLoggedIn: logins.claude,
      ghLoggedIn: logins.gh,
      ghAccount: logins.ghAccount,
      claudeAccount: logins.claude ? (logins.claudeAccount ?? null) : null,
      claudePlan: logins.claude ? (logins.claudePlan ?? null) : null,
      ghTokenScope: { tokenRepos: logins.tokenRepos },
      loginsCheckedAt: logins.checkedAt,
    })
    .where(eq(machine.id, logins.machineId))
    .returning();
  return row ?? null;
}

/** Keeps the Agent's latest doctor report (ADR 0007). */
export async function applyMachineDoctor(db: Db, machineId: string, doctor: MachineDoctor): Promise<void> {
  await db.update(machine).set({ doctor }).where(eq(machine.id, machineId));
}

export type DeleteMachineResult = { ok: true } | { ok: false; reason: "missing" | "busy" };

/**
 * Removes a Machine's row, refused while it has an Active Run: anything
 * not Succeeded or Cancelled, Dry-runs included. Ended Runs keep their history
 * with no Machine. The row lock serializes this with a Start queuing on the Machine.
 */
export async function deleteMachine(db: Db, machineId: string, actorEmail: string): Promise<DeleteMachineResult> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ id: machine.id }).from(machine).where(eq(machine.id, machineId)).for("update");
    if (!row) return { ok: false, reason: "missing" } as const;
    const [active] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(run)
      .where(and(eq(run.machineId, machineId), notInArray(run.state, ["succeeded", "cancelled"])));
    if (active!.n > 0) return { ok: false, reason: "busy" } as const;
    await tx.delete(machine).where(eq(machine.id, machineId));
    await recordAudit(tx, { actorEmail, action: "machine.remove", subjectType: "machine", subjectId: machineId });
    return { ok: true } as const;
  });
}

/** Saves a Machine's name and Slots. */
export async function updateMachineSettings(db: Db, machineId: string, settings: { name: string | null; slots: number }): Promise<void> {
  await db.update(machine).set(settings).where(eq(machine.id, machineId));
}

export type MachineFacts = {
  agentVersion: string;
  processId: string;
  os: string;
  arch: string;
  hostname: string;
  cpus: number;
  memoryMb: number;
  diskGb: number;
};

/** The Machine whose paired token hashes to `tokenHash`, if any. */
export async function machineOfTokenHash(db: Db, tokenHash: string): Promise<Machine | null> {
  const [row] = await db.select().from(machine).where(eq(machine.tokenHash, tokenHash));
  return row ?? null;
}

/** Marks a Machine connected with its Agent's facts (hello). */
export async function recordMachineConnected(db: Db, machineId: string, facts: MachineFacts, now: Date): Promise<void> {
  await db.update(machine).set({ ...facts, connected: true, connectedAt: now, lastHeartbeatAt: now }).where(eq(machine.id, machineId));
}

export async function recordMachineDisconnected(db: Db, machineId: string): Promise<void> {
  await db.update(machine).set({ connected: false }).where(eq(machine.id, machineId));
}

/** No socket survives a Gateway restart: every Machine reads disconnected until its hello. */
export async function markAllMachinesDisconnected(db: Db): Promise<void> {
  await db.update(machine).set({ connected: false }).where(eq(machine.connected, true));
}

/** Keeps the heartbeat's time, and its usage when the Agent sends one (older Agents do not). */
export async function recordMachineHeartbeat(db: Db, machineId: string, now: Date, usage?: MachineUsage): Promise<void> {
  await db.update(machine).set(usage ? { lastHeartbeatAt: now, usage } : { lastHeartbeatAt: now }).where(eq(machine.id, machineId));
}

export async function saveMachineLinkIds(db: Db, machineId: string, ids: { lastReceivedId: number; lastSentId: number }): Promise<void> {
  await db.update(machine).set(ids).where(eq(machine.id, machineId));
}

export type MachineRun = {
  runId: string;
  state: (typeof run.$inferSelect)["state"];
  mode: "real" | "dry";
  queuedAt: Date;
  startedAt: Date | null;
  ticketNumber: number;
  ticketTitle: string;
  projectId: string;
  flowName: string;
};
export type QueuedRun = MachineRun;

/** Each Machine's Runs in the given states, oldest first. */
async function machineRunsIn(db: Db, machineIds: readonly string[], states: MachineRun["state"][]): Promise<Map<string, MachineRun[]>> {
  const byMachine = new Map<string, MachineRun[]>(machineIds.map((id) => [id, []]));
  if (machineIds.length === 0) return byMachine;
  const rows = await db
    .select({
      machineId: run.machineId,
      runId: run.id,
      state: run.state,
      mode: run.mode,
      queuedAt: run.queuedAt,
      startedAt: run.startedAt,
      ticketNumber: ticket.number,
      ticketTitle: ticket.title,
      projectId: ticket.projectId,
      flowName: flow.name,
    })
    .from(run)
    .innerJoin(ticket, eq(ticket.id, run.ticketId))
    .innerJoin(flow, eq(flow.id, run.flowId))
    .where(and(inArray(run.machineId, [...machineIds]), inArray(run.state, states)))
    .orderBy(asc(run.queuedAt), asc(run.id));
  for (const { machineId, ...entry } of rows) byMachine.get(machineId!)!.push(entry);
  return byMachine;
}

/** The Queued Runs of each Machine in the order they will start (POD-3, spec M2 §6). */
export function queuedRuns(db: Db, machineIds: readonly string[]): Promise<Map<string, QueuedRun[]>> {
  return machineRunsIn(db, machineIds, ["queued"]);
}

/** The Runs holding each Machine's Slots: Running or Waiting for a human. */
export function slotRuns(db: Db, machineIds: readonly string[]): Promise<Map<string, MachineRun[]>> {
  return machineRunsIn(db, machineIds, ["running", "waiting_for_human"]);
}
