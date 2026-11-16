import { sql } from "drizzle-orm";
import pg from "pg";
import type { Db } from "./client";

// The web app runs on Vercel and cannot hold the Host Agent link (ADR 0004).
// It writes its change to the database, then asks the Gateway to act through
// Postgres NOTIFY, the same way `member.revoked` travels (spec M0 §7.1).

export const GATEWAY_COMMAND_CHANNEL = "gateway_command";

export type GatewayCommand =
  | { type: "pod.create" | "pod.start" | "pod.stop" | "pod.checkLogins"; podId: string }
  /** Run the Slot scheduler for a Pod after Runs were queued. */
  | { type: "schedule"; podId: string };

export type CommandPublish = (command: GatewayCommand) => Promise<void>;

const TYPES = new Set(["pod.create", "pod.start", "pod.stop", "pod.checkLogins", "schedule"]);

export function notifyGatewayCommand(db: Db): CommandPublish {
  return async (command) => {
    await db.execute(sql`select pg_notify(${GATEWAY_COMMAND_CHANNEL}, ${JSON.stringify(command)})`);
  };
}

export function parseGatewayCommand(payload: string): GatewayCommand | null {
  try {
    const value = JSON.parse(payload) as { type?: unknown; podId?: unknown };
    if (typeof value.type !== "string" || !TYPES.has(value.type) || typeof value.podId !== "string") return null;
    return { type: value.type, podId: value.podId } as GatewayCommand;
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
