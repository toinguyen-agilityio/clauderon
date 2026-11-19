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
  | { type: "run.resume"; machineId: string; runId: string };

export type CommandPublish = (command: GatewayCommand) => Promise<void>;

const TYPES = new Set(["machine.checkLogins", "machine.repaired", "schedule", "run.cancel", "run.resume"]);

export function notifyGatewayCommand(db: Db): CommandPublish {
  return async (command) => {
    await db.execute(sql`select pg_notify(${GATEWAY_COMMAND_CHANNEL}, ${JSON.stringify(command)})`);
  };
}

export function parseGatewayCommand(payload: string): GatewayCommand | null {
  try {
    const value = JSON.parse(payload) as { type?: unknown; machineId?: unknown; runId?: unknown; attemptIds?: unknown };
    if (typeof value.type !== "string" || !TYPES.has(value.type) || typeof value.machineId !== "string") return null;
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
