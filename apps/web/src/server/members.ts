import { isMachineReady } from "@clauderon/core";
import { isOperator, listAllowlist, listMachines, listMembers, machineActiveRuns, normalizeEmail, removeAllowlistEntry } from "@clauderon/db";
import type { AppDeps, Viewer } from "./deps";
import { removeMachine } from "./machines";

// The Members page (MEM-4): every Member reads the team; only an Operator adds
// or removes an email and removes another Member's Machine.

export type MemberStatus = "active" | "invited" | "removed";

export type MemberMachine = {
  id: string;
  name: string | null;
  paired: boolean;
  connected: boolean;
  ready: boolean;
  claudeLoggedIn: boolean;
  ghLoggedIn: boolean;
  /** Anything not Succeeded or Cancelled: it blocks removing the Machine and the email (MEM-3). */
  activeRuns: number;
};

export type MemberRow = {
  email: string;
  name: string | null;
  pictureUrl: string | null;
  operator: boolean;
  /** Active: signed in at least once; invited: allowed but never signed in; removed: no longer allowed but still has a Machine to clean up. */
  status: MemberStatus;
  lastSignInAt: Date | null;
  machine: MemberMachine | null;
};

export type MembersView = { rows: MemberRow[]; canManage: boolean; viewerEmail: string };

/**
 * Allowed emails (Operators from configuration first), plus anyone no longer
 * allowed whose Machine is still there. Removed Members without a Machine are
 * hidden; their history stays in Runs and the audit log.
 */
export async function viewMembers(deps: AppDeps, viewer: Viewer): Promise<MembersView> {
  const [allowed, members, machines] = await Promise.all([listAllowlist(deps.db, deps.operators), listMembers(deps.db), listMachines(deps.db)]);
  const active = await machineActiveRuns(
    deps.db,
    machines.map((m) => m.id),
  );
  const memberByEmail = new Map(members.map((m) => [m.email, m]));
  const machineByMember = new Map(machines.map((m) => [m.memberId, m]));
  const allowedEmails = new Set(allowed.map((a) => a.email));

  const row = (email: string, removed: boolean): MemberRow => {
    const m = memberByEmail.get(email);
    const machine = m ? machineByMember.get(m.id) : undefined;
    return {
      email,
      name: m?.name ?? null,
      pictureUrl: m?.pictureUrl ?? null,
      operator: isOperator(email, deps.operators),
      status: removed ? "removed" : m?.lastSignInAt ? "active" : "invited",
      lastSignInAt: m?.lastSignInAt ?? null,
      machine: machine
        ? {
            id: machine.id,
            name: machine.name,
            paired: machine.tokenHash !== null,
            connected: machine.connected,
            ready: isMachineReady(machine),
            claudeLoggedIn: machine.claudeLoggedIn,
            ghLoggedIn: machine.ghLoggedIn,
            activeRuns: active.get(machine.id) ?? 0,
          }
        : null,
    };
  };

  const removedWithMachine = machines.filter((m) => !allowedEmails.has(m.owner.email)).map((m) => row(m.owner.email, true));
  return {
    rows: [...allowed.map((a) => row(a.email, false)), ...removedWithMachine],
    canManage: isOperator(viewer.email, deps.operators),
    viewerEmail: viewer.email,
  };
}

export type RemoveMemberResult =
  | { ok: true }
  | { ok: false; reason: "operator" | "not-found" }
  /** The Member's Machine has Active Runs; `machineId` lets the page link to them. */
  | { ok: false; reason: "active-runs"; activeRuns: number; machineId: string };

/**
 * Remove an email (MEM-3, MEM-4): refused while the Member's Machine has
 * Active Runs. Otherwise the Machine is removed first, so its Agent is
 * disconnected and its token stops working, then the email, which ends the
 * Member's sessions and connections at once.
 */
export async function removeMember(deps: AppDeps, actor: Viewer, email: string): Promise<RemoveMemberResult | "not-found"> {
  if (!isOperator(actor.email, deps.operators)) return "not-found";
  const normalized = normalizeEmail(email);
  if (isOperator(normalized, deps.operators)) return { ok: false, reason: "operator" };

  const machine = (await listMachines(deps.db)).find((m) => m.owner.email === normalized);
  if (machine) {
    const activeRuns = (await machineActiveRuns(deps.db, [machine.id])).get(machine.id) ?? 0;
    // removeMachine re-checks inside its transaction, in case a Run started meanwhile.
    const removed = activeRuns > 0 ? null : await removeMachine(deps, actor, machine.id);
    if (!removed || (removed !== "not-found" && !removed.ok))
      return { ok: false, reason: "active-runs", activeRuns: Math.max(activeRuns, 1), machineId: machine.id };
  }
  const result = await removeAllowlistEntry(deps.db, actor.email, normalized, deps.operators, deps.publish, deps.clock.now());
  // A Member already off the allowlist only had their Machine left to remove.
  return machine && !result.ok && result.reason === "not-found" ? { ok: true } : result;
}
