import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { PAIRING_TTL_MS, formatPairingCode } from "@clauderon/core";
import {
  MAX_PENDING_PAIRINGS,
  approvePairing,
  createPairing,
  findPendingPairing,
  getMachine,
  getMachineOfMember,
  hashToken,
  machineOfTokenHash,
  pairingStatus,
  schema,
  type Db,
} from "../src/index";
import { createTestDatabase, type TestDatabase } from "../src/test-database";

let test: TestDatabase;
let db: Db;
const now = new Date("2026-11-16T09:00:00Z");
const later = (ms: number) => new Date(now.getTime() + ms);
let ann: { id: string; email: string };

beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
});
afterAll(() => test.drop());
beforeEach(async () => {
  await db.execute(sql`truncate member, machine, pairing, audit_entry cascade`);
  const [row] = await db.insert(schema.member).values({ email: "ann@example.com", name: "Ann" }).returning();
  ann = { id: row!.id, email: row!.email };
});

const request = (token: string, hostname = "ann-laptop") => ({ tokenHash: hashToken(token), hostname, os: "darwin", arch: "arm64" });

async function started(token: string, hostname?: string) {
  const result = await createPairing(db, request(token, hostname), now);
  if (!result.ok) throw new Error(result.reason);
  return result.pairing;
}

describe("Pairing (ADR 0006)", () => {
  it("a new code is pending until a Member approves it, then creates their Machine with the token's hash", async () => {
    const pairing = await started("t1");
    expect(pairing.code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    expect(pairing.expiresAt).toEqual(later(PAIRING_TTL_MS));
    expect(await pairingStatus(db, pairing.id, hashToken("t1"), now)).toBe("pending");

    // The approver sees the hostname first; the code can be typed with a dash and in lower case.
    const typed = formatPairingCode(pairing.code).toLowerCase();
    expect(await findPendingPairing(db, typed, now)).toMatchObject({ id: pairing.id, hostname: "ann-laptop" });

    const approved = await approvePairing(db, ann, typed, later(1000));
    expect(approved).toMatchObject({ ok: true, replaced: false, machine: { memberId: ann.id, hostname: "ann-laptop", slots: 2 } });
    expect(await pairingStatus(db, pairing.id, hashToken("t1"), later(2000))).toBe("approved");
    expect((await machineOfTokenHash(db, hashToken("t1")))?.memberId).toBe(ann.id);

    const [audit] = await db.select().from(schema.auditEntry);
    expect(audit).toMatchObject({ actorEmail: ann.email, action: "machine.pair", detail: { hostname: "ann-laptop", replaced: false } });
  });

  it("no secret is stored: only the token's hash", async () => {
    await started("plain-token");
    const [row] = await db.select().from(schema.pairing);
    expect(JSON.stringify(row)).not.toContain("plain-token");
  });

  it("only the Agent holding the token sees its status; an unknown id or token reads expired", async () => {
    const pairing = await started("t1");
    expect(await pairingStatus(db, pairing.id, hashToken("other"), now)).toBe("expired");
    expect(await pairingStatus(db, "00000000-0000-0000-0000-000000000000", hashToken("t1"), now)).toBe("expired");
    expect(await pairingStatus(db, "not-a-uuid", hashToken("t1"), now)).toBe("expired");
  });

  it("an expired code can no longer be found or approved", async () => {
    const pairing = await started("t1");
    const after = later(PAIRING_TTL_MS + 1);
    expect(await pairingStatus(db, pairing.id, hashToken("t1"), after)).toBe("expired");
    expect(await findPendingPairing(db, pairing.code, after)).toBeNull();
    expect(await approvePairing(db, ann, pairing.code, after)).toEqual({ ok: false, reason: "not-found" });
    expect(await getMachineOfMember(db, ann.id)).toBeNull();
  });

  it("a code is approved once", async () => {
    const pairing = await started("t1");
    expect((await approvePairing(db, ann, pairing.code, now)).ok).toBe(true);
    expect(await approvePairing(db, ann, pairing.code, now)).toEqual({ ok: false, reason: "not-found" });
  });

  it("pairing a second computer replaces the token and resets the link but keeps the Machine and its Slots", async () => {
    const first = await approvePairing(db, ann, (await started("old")).code, now);
    if (!first.ok) throw new Error("not paired");
    await db.update(schema.machine).set({ slots: 4, connected: true, lastSentId: 7, lastReceivedId: 3, claudeLoggedIn: true, ghLoggedIn: true, claudeAccount: "ann@example.com", claudePlan: "pro" });

    const second = await approvePairing(db, ann, (await started("new", "ann-desktop")).code, later(1000));
    expect(second).toMatchObject({ ok: true, replaced: true });
    const machine = await getMachine(db, first.machine.id);
    expect(machine).toMatchObject({
      hostname: "ann-desktop",
      slots: 4,
      connected: false,
      lastSentId: 0,
      lastReceivedId: 0,
      claudeLoggedIn: false,
      ghLoggedIn: false,
      // The new computer may use another Claude account: unknown until checked.
      claudeAccount: null,
      claudePlan: null,
    });
    expect(await machineOfTokenHash(db, hashToken("old"))).toBeNull();
    expect((await machineOfTokenHash(db, hashToken("new")))?.id).toBe(first.machine.id);
  });

  it("refuses a token already paired, and a flood of pending codes", async () => {
    await approvePairing(db, ann, (await started("t1")).code, now);
    expect(await createPairing(db, request("t1"), now)).toEqual({ ok: false, reason: "token-in-use" });

    for (let i = 0; i < MAX_PENDING_PAIRINGS; i++) await started(`flood-${i}`);
    expect(await createPairing(db, request("one-more"), now)).toEqual({ ok: false, reason: "busy" });
    // Expired codes are cleared, so pairing works again later.
    expect((await createPairing(db, request("one-more"), later(PAIRING_TTL_MS + 1))).ok).toBe(true);
  });
});
