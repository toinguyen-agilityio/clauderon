import { sql } from "drizzle-orm";
import pg from "pg";
import type { Db } from "./client";

// The web app cannot hold the Agents' links (ADR 0004).
// It writes its change to the database, then asks the Gateway to act through
// Postgres NOTIFY, the same way `member.revoked` travels (spec M0 §7.1).

export const GATEWAY_COMMAND_CHANNEL = "gateway_command";

export type GatewayCommand =
  /** Check the Machine's Claude Code and gh logins now. */
  | { type: "machine.checkLogins"; machineId: string }
  /** The Machine was paired anew or unpaired: drop the connection of its old token (ADR 0006). */
  | { type: "machine.repaired"; machineId: string }
  /** Run the Slot scheduler for a Machine after Runs were queued. */
  | { type: "schedule"; machineId: string }
  /** A Run was cancelled: kill its cancelled Attempts on the Machine, then schedule (RUN-8). */
  | { type: "run.cancel"; machineId: string; runId: string; attemptIds: string[] }
  /** A person approved or answered (spec M3 §2): continue the Run or resume its Grill session. */
  | { type: "run.resume"; machineId: string; runId: string }
  /** A Run left `waiting_for_human` in the web app: tell open Needs you pages. Needs no Machine. */
  | { type: "needs.changed" }
  /**
   * Another Member acted on a Run (#198): tell its Starter's open tabs. Needs no
   * Machine; an older Gateway drops it. `flowNodeId` names the Node acted on.
   */
  | { type: "member.notify"; memberEmail: string; kind: MemberNotifyKind; runId: string; actorEmail: string; flowNodeId?: string };

/** The actions of another Member a Run's Starter is told about. */
export const MEMBER_NOTIFY_KINDS = ["approved", "rejected", "answered", "cancelled", "retried"] as const;
export type MemberNotifyKind = (typeof MEMBER_NOTIFY_KINDS)[number];

export type CommandPublish = (command: GatewayCommand) => Promise<void>;

const TYPES = new Set(["machine.checkLogins", "machine.repaired", "schedule", "run.cancel", "run.resume", "needs.changed", "member.notify"]);

export function notifyGatewayCommand(db: Db): CommandPublish {
  return async (command) => {
    await db.execute(sql`select pg_notify(${GATEWAY_COMMAND_CHANNEL}, ${JSON.stringify(command)})`);
  };
}

export function parseGatewayCommand(payload: string): GatewayCommand | null {
  try {
    const value = JSON.parse(payload) as Record<string, unknown>;
    if (typeof value.type !== "string" || !TYPES.has(value.type)) return null;
    if (value.type === "needs.changed") return { type: "needs.changed" };
    if (value.type === "member.notify") {
      const { memberEmail, kind, runId, actorEmail, flowNodeId } = value;
      if (typeof memberEmail !== "string" || typeof runId !== "string" || typeof actorEmail !== "string") return null;
      if (!(MEMBER_NOTIFY_KINDS as readonly unknown[]).includes(kind)) return null;
      if (flowNodeId !== undefined && typeof flowNodeId !== "string") return null;
      return { type: "member.notify", memberEmail, kind: kind as MemberNotifyKind, runId, actorEmail, ...(flowNodeId !== undefined ? { flowNodeId } : {}) };
    }
    if (typeof value.machineId !== "string") return null;
    if (value.type === "run.cancel") {
      const { runId, attemptIds } = value;
      if (typeof runId !== "string" || !Array.isArray(attemptIds) || !attemptIds.every((a) => typeof a === "string")) return null;
      return { type: "run.cancel", machineId: value.machineId, runId, attemptIds: attemptIds as string[] };
    }
    if (value.type === "run.resume") {
      if (typeof value.runId !== "string") return null;
      return { type: "run.resume", machineId: value.machineId, runId: value.runId };
    }
    return { type: value.type, machineId: value.machineId } as GatewayCommand;
  } catch {
    return null;
  }
}

/** Calls `onCommand` for every command any web instance publishes. Returns a stop function. */
export async function listenGatewayCommands(url: string, onCommand: (command: GatewayCommand) => void): Promise<() => Promise<void>> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  client.on("notification", (message) => {
    if (message.channel !== GATEWAY_COMMAND_CHANNEL || !message.payload) return;
    const command = parseGatewayCommand(message.payload);
    if (command) onCommand(command);
  });
  await client.query(`listen ${GATEWAY_COMMAND_CHANNEL}`);
  return () => client.end();
}
