import { randomInt } from "node:crypto";
import { and, count, eq, gt, isNull, lt } from "drizzle-orm";
import { PAIRING_ALPHABET, PAIRING_CODE_LENGTH, PAIRING_TTL_MS, normalizePairingCode } from "@clauderon/core";
import type { Db } from "./client";
import { recordAudit } from "./access";
import { MACHINE_DEFAULT_SLOTS, type Machine } from "./machines";
import { machine, pairing } from "./schema";

// Pairing (ADR 0006): an Agent asks for a code, a signed-in Member approves
// it, and the token behind it becomes their Machine's token.

/** Pending codes allowed at once, so an open endpoint cannot fill the table. */
export const MAX_PENDING_PAIRINGS = 50;

export type Pairing = typeof pairing.$inferSelect;
/** What an Agent sends to pair: its token's SHA-256 hash and its facts. */
export type PairingRequest = { tokenHash: string; hostname: string; os: string; arch: string };

function newCode(): string {
  let code = "";
  for (let i = 0; i < PAIRING_CODE_LENGTH; i++) code += PAIRING_ALPHABET[randomInt(PAIRING_ALPHABET.length)];
  return code;
}

export type CreatePairingResult = { ok: true; pairing: Pairing } | { ok: false; reason: "busy" | "token-in-use" };

/** Starts a pairing for an Agent; expired codes are cleared first. */
export async function createPairing(db: Db, request: PairingRequest, now: Date): Promise<CreatePairingResult> {
  await db.delete(pairing).where(and(lt(pairing.expiresAt, now), isNull(pairing.approvedAt)));
  const [pending] = await db.select({ n: count() }).from(pairing).where(and(gt(pairing.expiresAt, now), isNull(pairing.approvedAt)));
  if (pending!.n >= MAX_PENDING_PAIRINGS) return { ok: false, reason: "busy" };
  const [used] = await db.select({ id: machine.id }).from(machine).where(eq(machine.tokenHash, request.tokenHash));
  if (used) return { ok: false, reason: "token-in-use" };

  for (let tries = 0; tries < 5; tries++) {
    const [row] = await db
      .insert(pairing)
      .values({ ...request, code: newCode(), expiresAt: new Date(now.getTime() + PAIRING_TTL_MS) })
      .onConflictDoNothing()
      .returning();
    if (row) return { ok: true, pairing: row };
  }
  // The token hash itself collided: the Agent reused a token.
  return { ok: false, reason: "token-in-use" };
}

/** What an Agent sees while it waits: pending, approved, or expired (also when unknown). */
export async function pairingStatus(db: Db, pairingId: string, tokenHash: string, now: Date): Promise<"pending" | "approved" | "expired"> {
  if (!/^[0-9a-f-]{36}$/i.test(pairingId)) return "expired";
  const [row] = await db.select().from(pairing).where(and(eq(pairing.id, pairingId), eq(pairing.tokenHash, tokenHash)));
  if (!row) return "expired";
  if (row.approvedAt) return "approved";
  return row.expiresAt > now ? "pending" : "expired";
}

export type PendingPairing = Pick<Pairing, "id" | "code" | "hostname" | "os" | "arch" | "expiresAt">;

/** The pending pairing with this code, for the approver to check its hostname first. */
export async function findPendingPairing(db: Db, code: string, now: Date): Promise<PendingPairing | null> {
  const [row] = await db
    .select({ id: pairing.id, code: pairing.code, hostname: pairing.hostname, os: pairing.os, arch: pairing.arch, expiresAt: pairing.expiresAt })
    .from(pairing)
    .where(and(eq(pairing.code, normalizePairingCode(code)), isNull(pairing.approvedAt), gt(pairing.expiresAt, now)));
  return row ?? null;
}

export type ApprovePairingResult =
  | { ok: true; machine: Machine; replaced: boolean }
  | { ok: false; reason: "not-found" };

/**
 * Pairs the approver's Machine with the code's token (ADR 0006): creates the
 * Machine, or gives the existing one the new token so a previous computer
 * can no longer connect. Its Runs and Slots stay.
 */
export async function approvePairing(db: Db, approver: { id: string; email: string }, code: string, now: Date): Promise<ApprovePairingResult> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(pairing)
      .where(and(eq(pairing.code, normalizePairingCode(code)), isNull(pairing.approvedAt), gt(pairing.expiresAt, now)))
      .for("update");
    if (!row) return { ok: false, reason: "not-found" } as const;
    await tx.update(pairing).set({ approvedAt: now, approvedByMemberId: approver.id }).where(eq(pairing.id, row.id));

    const [existing] = await tx.select().from(machine).where(eq(machine.memberId, approver.id)).for("update");
    const paired = { tokenHash: row.tokenHash, pairedAt: now, hostname: row.hostname, os: row.os, arch: row.arch };
    let saved: Machine;
    if (existing) {
      // A new computer has not checked its logins yet.
      const [updated] = await tx
        .update(machine)
        .set({ ...paired, connected: false, lastReceivedId: 0, lastSentId: 0, claudeLoggedIn: false, ghLoggedIn: false, claudeAccount: null, claudePlan: null, loginsCheckedAt: null, doctor: null })
        .where(eq(machine.id, existing.id))
        .returning();
      saved = updated!;
    } else {
      const [created] = await tx
        .insert(machine)
        .values({ memberId: approver.id, slots: MACHINE_DEFAULT_SLOTS, ...paired })
        .returning();
      saved = created!;
    }
    await recordAudit(tx, {
      actorEmail: approver.email,
      action: "machine.pair",
      subjectType: "machine",
      subjectId: saved.id,
      detail: { hostname: row.hostname, os: row.os, arch: row.arch, replaced: Boolean(existing?.tokenHash) },
    });
    return { ok: true, machine: saved, replaced: Boolean(existing?.tokenHash) } as const;
  });
}

/** Unpairs a Machine: its token stops working; the row, its Runs and Slots stay. */
export async function unpairMachine(db: Db, machineId: string, actorEmail: string): Promise<boolean> {
  const rows = await db
    .update(machine)
    .set({ tokenHash: null, connected: false })
    .where(eq(machine.id, machineId))
    .returning({ id: machine.id });
  if (rows.length === 0) return false;
  await recordAudit(db, { actorEmail, action: "machine.unpair", subjectType: "machine", subjectId: machineId });
  return true;
}
