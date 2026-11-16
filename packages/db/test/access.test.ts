import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import {
  addAllowlistEntry,
  createSession,
  endMemberAccess,
  endSession,
  listAllowlist,
  loadSession,
  removeAllowlistEntry,
  schema,
  signIn,
  type Db,
} from "../src/index";
import { createTestDatabase, type TestDatabase } from "../src/test-database";

let test: TestDatabase;
let db: Db;
const operators = ["op@example.com"];
const now = new Date("2026-11-16T09:00:00Z");
const later = (hours: number) => new Date(now.getTime() + hours * 3_600_000);
const profile = (email: string, emailVerified = true) => ({ email, emailVerified, name: "Ann", picture: null });

beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
});
afterAll(() => test.drop());
beforeEach(async () => {
  await db.execute(sql`truncate member, allowlist_entry, audit_entry cascade`);
});

describe("signIn", () => {
  it("T0-10: an Operator email always gets in and creates the Member", async () => {
    const result = await signIn(db, profile("Op@Example.com"), operators, now);
    expect(result).toMatchObject({ ok: true, member: { email: "op@example.com", name: "Ann" } });
  });

  it("T0-10: an unverified Google email is refused", async () => {
    expect(await signIn(db, profile("op@example.com", false), operators, now)).toEqual({ ok: false, reason: "unverified" });
  });

  it("T0-10: an email not on the allowlist is refused and no Member is created", async () => {
    expect(await signIn(db, profile("stranger@example.com"), operators, now)).toEqual({ ok: false, reason: "not-allowed" });
    expect(await db.select().from(schema.member)).toEqual([]);
  });

  it("lets an allowlisted email in and updates the Member on every sign-in", async () => {
    await addAllowlistEntry(db, "op@example.com", "ann@example.com", operators);
    await signIn(db, profile("ann@example.com"), operators, now);
    const second = await signIn(db, { ...profile("ann@example.com"), name: "Ann B" }, operators, later(1));
    expect(second).toMatchObject({ ok: true, member: { name: "Ann B", lastSignInAt: later(1) } });
    expect(await db.select().from(schema.member)).toHaveLength(1);
  });
});

describe("sessions", () => {
  it("lasts 24 hours and ends on sign out", async () => {
    const signedIn = await signIn(db, profile("op@example.com"), operators, now);
    if (!signedIn.ok) throw new Error("expected sign-in");
    const created = await createSession(db, signedIn.member.id, "token-1", now);
    expect(created.expiresAt).toEqual(later(24));

    expect(await loadSession(db, "token-1", operators, later(23))).toMatchObject({ member: { email: "op@example.com" } });
    expect(await loadSession(db, "token-1", operators, later(25))).toBeNull();

    await endSession(db, "token-1", later(1));
    expect(await loadSession(db, "token-1", operators, later(2))).toBeNull();
  });

  it("never stores the token itself", async () => {
    const signedIn = await signIn(db, profile("op@example.com"), operators, now);
    if (!signedIn.ok) throw new Error("expected sign-in");
    await createSession(db, signedIn.member.id, "plain-token-value", now);
    const rows = await db.select().from(schema.session);
    expect(JSON.stringify(rows)).not.toContain("plain-token-value");
  });

  it("T0-11: removing an email ends its sessions and announces it", async () => {
    await addAllowlistEntry(db, "op@example.com", "ann@example.com", operators);
    const signedIn = await signIn(db, profile("ann@example.com"), operators, now);
    if (!signedIn.ok) throw new Error("expected sign-in");
    await createSession(db, signedIn.member.id, "token-ann", now);

    const revoked: string[] = [];
    await removeAllowlistEntry(db, "op@example.com", "ann@example.com", operators, (email) => {
      revoked.push(email);
    });

    expect(revoked).toEqual(["ann@example.com"]);
    expect(await loadSession(db, "token-ann", operators, later(1))).toBeNull();
  });

  it("re-checks the allowlist when loading a session", async () => {
    await addAllowlistEntry(db, "op@example.com", "ann@example.com", operators);
    const signedIn = await signIn(db, profile("ann@example.com"), operators, now);
    if (!signedIn.ok) throw new Error("expected sign-in");
    await createSession(db, signedIn.member.id, "token-ann", now);
    // Removed behind the app's back: the next request is still refused.
    await db.delete(schema.allowlistEntry);
    expect(await loadSession(db, "token-ann", operators, later(1))).toBeNull();
  });

  it("endMemberAccess ends every session of the Member", async () => {
    const signedIn = await signIn(db, profile("op@example.com"), operators, now);
    if (!signedIn.ok) throw new Error("expected sign-in");
    await createSession(db, signedIn.member.id, "a", now);
    await createSession(db, signedIn.member.id, "b", now);
    await endMemberAccess(db, "op@example.com", later(1), () => {});
    const open = await db.select().from(schema.session).where(sql`ended_at is null`);
    expect(open).toEqual([]);
  });
});

describe("allowlist", () => {
  it("T0-12: add and remove write audit entries", async () => {
    await addAllowlistEntry(db, "op@example.com", "Ann@Example.com", operators);
    await removeAllowlistEntry(db, "op@example.com", "ann@example.com", operators, () => {});
    const audit = await db.select().from(schema.auditEntry).orderBy(schema.auditEntry.at);
    expect(audit.map((a) => [a.actorEmail, a.action, a.subjectType, a.subjectId])).toEqual([
      ["op@example.com", "allowlist.add", "allowlist_entry", "ann@example.com"],
      ["op@example.com", "allowlist.remove", "allowlist_entry", "ann@example.com"],
    ]);
  });

  it("validates the email shape, lower-cases it and rejects duplicates", async () => {
    expect(await addAllowlistEntry(db, "op@example.com", "not-an-email", operators)).toEqual({ ok: false, reason: "invalid-email" });
    expect(await addAllowlistEntry(db, "op@example.com", "@example.com", operators)).toEqual({ ok: false, reason: "invalid-email" });
    expect(await addAllowlistEntry(db, "op@example.com", " Ann@Example.com ", operators)).toEqual({ ok: true, email: "ann@example.com" });
    expect(await addAllowlistEntry(db, "op@example.com", "ann@example.com", operators)).toEqual({ ok: false, reason: "duplicate" });
    expect(await addAllowlistEntry(db, "op@example.com", "OP@example.com", operators)).toEqual({ ok: false, reason: "duplicate" });
  });

  it("lists Operator emails first, from configuration, then entries", async () => {
    await addAllowlistEntry(db, "op@example.com", "ann@example.com", operators);
    const rows = await listAllowlist(db, operators);
    expect(rows).toEqual([
      { email: "op@example.com", fromConfiguration: true, addedByEmail: null, addedAt: null },
      { email: "ann@example.com", fromConfiguration: false, addedByEmail: "op@example.com", addedAt: expect.any(Date) },
    ]);
  });

  it("refuses to remove an Operator email", async () => {
    expect(await removeAllowlistEntry(db, "op@example.com", "op@example.com", operators, () => {})).toEqual({
      ok: false,
      reason: "operator",
    });
  });
});
