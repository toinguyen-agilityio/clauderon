import { eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { podHost } from "./schema.js";

const ROW = 1;

export type HostFacts = {
  agentVersion: string;
  processId: string;
  arch: string;
  cpus: number;
  memoryMb: number;
  diskGb: number;
  dockerRunning: boolean;
};

export async function getPodHost(db: Db) {
  const [row] = await db.select().from(podHost).where(eq(podHost.id, ROW));
  return row ?? null;
}

/** Marks the Host Agent connected with its facts; returns the stored link ids. */
export async function recordHostConnected(db: Db, facts: HostFacts, now: Date) {
  const values = { ...facts, connected: true, connectedAt: now, lastHeartbeatAt: now };
  const [row] = await db
    .insert(podHost)
    .values({ id: ROW, ...values })
    .onConflictDoUpdate({ target: podHost.id, set: values })
    .returning();
  return { lastReceivedId: row!.lastReceivedId, lastSentId: row!.lastSentId };
}

export async function recordHostDisconnected(db: Db): Promise<void> {
  await db.update(podHost).set({ connected: false }).where(eq(podHost.id, ROW));
}

export async function recordHeartbeat(db: Db, now: Date): Promise<void> {
  await db.update(podHost).set({ lastHeartbeatAt: now }).where(eq(podHost.id, ROW));
}

export async function saveLinkIds(db: Db, ids: { lastReceivedId: number; lastSentId: number }): Promise<void> {
  await db.update(podHost).set(ids).where(eq(podHost.id, ROW));
}
