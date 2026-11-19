import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addAllowlistEntry, schema, signIn, sql, type Db, type Member } from "@clauderon/db";
import { verifyGatewayTicket } from "@clauderon/protocol";
import { FakeClock, createTestDatabase, type TestDatabase } from "@clauderon/testing";
import { addToAllowlist, checkGoogleSignIn, type AccessDeps } from "../src/server/access";
import type { AppDeps } from "../src/server/deps";
import { removeMember, viewMembers } from "../src/server/members";
import { clauderonAdapter } from "../src/server/auth-adapter";
import { gatewayTicket } from "../src/server/gateway-ticket";

const operators = ["op@example.com"];
let test: TestDatabase;
let deps: AccessDeps;
let db: Db;
let clock: FakeClock;
let revoked: string[];

beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
});
afterAll(() => test.drop());
beforeEach(async () => {
  await db.execute(sql`truncate member, allowlist_entry, audit_entry cascade`);
  clock = new FakeClock();
  revoked = [];
  deps = { db, operators, clock, publish: (email) => void revoked.push(email) };
});

async function member(email: string): Promise<Member> {
  if (!operators.includes(email)) await addAllowlistEntry(db, "op@example.com", email, operators);
  const result = await signIn(db, { email, emailVerified: true, name: null, picture: null }, operators, clock.now());
  if (!result.ok) throw new Error("refused");
  return result.member;
}

/** Signs in through the adapter the way Auth.js does; returns the cookie value. */
async function signInWithCookie(email: string): Promise<string> {
  const adapter = clauderonAdapter(db, operators, clock);
  const m = await member(email);
  const token = `cookie-${email}`;
  await adapter.createSession!({ sessionToken: token, userId: m.id, expires: new Date() });
  return token;
}

const cookies = (token: string) => (name: string) => (name === "authjs.session-token" ? token : undefined);

describe("Google sign-in (T0-10)", () => {
  it("an Operator email always gets in", async () => {
    expect(await checkGoogleSignIn(deps, { email: "op@example.com", email_verified: true })).toEqual({ ok: true });
  });

  it("an unverified or non-allowlisted email gets access denied and no Member", async () => {
    expect(await checkGoogleSignIn(deps, { email: "op@example.com", email_verified: false })).toEqual({ ok: false, email: "op@example.com" });
    expect(await checkGoogleSignIn(deps, { email: "x@example.com", email_verified: true })).toEqual({ ok: false, email: "x@example.com" });
    expect(await checkGoogleSignIn(deps, undefined)).toEqual({ ok: false, email: null });
    expect(await db.select().from(schema.member)).toEqual([]);
  });
});

describe("Auth.js adapter", () => {
  it("links the Google account without keeping any OAuth token (NFR-1)", async () => {
    const adapter = clauderonAdapter(db, operators, clock);
    const m = await member("op@example.com");
    await adapter.linkAccount!({
      userId: m.id,
      type: "oidc",
      provider: "google",
      providerAccountId: "1234",
      access_token: "ya29.secret-access",
      id_token: "eyJ.secret-id",
      refresh_token: "1//secret-refresh",
    });
    expect(await adapter.getUserByAccount!({ provider: "google", providerAccountId: "1234" })).toMatchObject({ email: "op@example.com" });
    const stored = JSON.stringify(await db.execute(sql`select * from member_account`));
    expect(stored).not.toMatch(/secret/);
  });

  it("a session lasts 24 hours, is never extended, and sign out ends it", async () => {
    const adapter = clauderonAdapter(db, operators, clock);
    const token = await signInWithCookie("op@example.com");
    expect((await adapter.getSessionAndUser!(token))?.session.expires).toEqual(new Date("2026-11-17T09:00:00Z"));
    expect(await adapter.updateSession!({ sessionToken: token, expires: new Date("2030-01-01") })).toBeNull();

    await adapter.deleteSession!(token);
    expect(await adapter.getSessionAndUser!(token)).toBeNull();
  });
});

// removeMember also removes a Machine, which needs the Gateway command seam.
const app = () => ({ ...deps, command: async () => {} }) as unknown as AppDeps;

describe("Members page (T0-12)", () => {
  it("a non-Operator reads the team but cannot add or remove", async () => {
    const ann = await member("ann@example.com");
    expect(await viewMembers(app(), ann)).toMatchObject({ canManage: false });
    expect(await addToAllowlist(deps, ann, "bob@example.com")).toBe("not-found");
    expect(await removeMember(app(), ann, "ann@example.com")).toBe("not-found");
  });

  it("the Operator sees the list; add and remove write audit entries", async () => {
    const op = await member("op@example.com");
    expect(await addToAllowlist(deps, op, "bob@example.com")).toEqual({ ok: true, email: "bob@example.com" });
    expect(await viewMembers(app(), op)).toMatchObject({
      canManage: true,
      rows: [expect.objectContaining({ email: "op@example.com", operator: true }), expect.objectContaining({ email: "bob@example.com", operator: false })],
    });
    expect(await removeMember(app(), op, "bob@example.com")).toEqual({ ok: true });
    const actions = (await db.select().from(schema.auditEntry)).map((a) => a.action).sort();
    expect(actions).toEqual(["allowlist.add", "allowlist.remove"]);
  });
});

describe("Removing an email (T0-11)", () => {
  it("ends its sessions: its next request gets 401 and the cookie is cleared", async () => {
    const op = await member("op@example.com");
    const token = await signInWithCookie("ann@example.com");

    const before = await gatewayTicket(deps, cookies(token), "secret");
    expect(before.status).toBe(200);
    if (before.status === 200) expect(verifyGatewayTicket(before.ticket, clock.now(), "secret")).toEqual(expect.any(String));

    await removeMember(app(), op, "ann@example.com");
    expect(revoked).toEqual(["ann@example.com"]);
    expect(await gatewayTicket(deps, cookies(token), "secret")).toEqual({ status: 401, clearCookies: true });
  });

  it("a request with no session gets 401 without clearing anything", async () => {
    expect(await gatewayTicket(deps, () => undefined, "secret")).toEqual({ status: 401, clearCookies: false });
  });
});
