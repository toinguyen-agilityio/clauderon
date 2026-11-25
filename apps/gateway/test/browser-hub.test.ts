import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  addAllowlistEntry,
  createSession,
  listenMemberRevoked,
  notifyMemberRevoked,
  removeAllowlistEntry,
  signIn,
  sql,
  type Db,
} from "@clauderon/db";
import { CloseCode, createGatewayTicket } from "@clauderon/protocol";
import { FakeClock, createTestDatabase, memorySocketPair, settle, type TestDatabase } from "@clauderon/testing";
import { BrowserHub } from "../src/browser-hub";

const SECRET = "session-secret";
const operators = ["op@example.com"];
let test: TestDatabase;
let db: Db;
let clock: FakeClock;
let hub: BrowserHub;

beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
});
afterAll(() => test.drop());
beforeEach(async () => {
  await db.execute(sql`truncate member, allowlist_entry, audit_entry cascade`);
  clock = new FakeClock();
  hub = new BrowserHub({ db, operators, sessionSecret: SECRET, clock });
});

async function sessionFor(email: string) {
  if (!operators.includes(email)) await addAllowlistEntry(db, "op@example.com", email, operators);
  const result = await signIn(db, { email, emailVerified: true, name: null, picture: null }, operators, clock.now());
  if (!result.ok) throw new Error("sign-in refused");
  return createSession(db, result.member.id, `token-${email}`, clock.now());
}

async function open(ticket: string | undefined) {
  const [browser, gateway] = memorySocketPair();
  await hub.attach(gateway, ticket);
  await settle();
  return browser;
}

describe("BrowserHub", () => {
  it("accepts a socket whose ticket names a live session", async () => {
    const session = await sessionFor("ann@example.com");
    const browser = await open(createGatewayTicket(session.id, clock.now(), SECRET));
    expect(browser.closed).toBe(false);
    expect(hub.count("ann@example.com")).toBe(1);
  });

  it("closes a socket with no ticket, a forged one, or an ended session with 4401", async () => {
    expect((await open(undefined)).closeCode).toBe(CloseCode.Unauthorized);
    expect((await open(createGatewayTicket("00000000-0000-0000-0000-000000000000", clock.now(), "wrong"))).closeCode).toBe(
      CloseCode.Unauthorized,
    );
    const session = await sessionFor("ann@example.com");
    await db.execute(sql`update session set ended_at = now()`);
    expect((await open(createGatewayTicket(session.id, clock.now(), SECRET))).closeCode).toBe(CloseCode.Unauthorized);
  });

  it("T0-11: removing an email closes that Member's open sockets with 4403", async () => {
    const stop = await listenMemberRevoked(test.url, (email) => hub.revoke(email));
    try {
      const ann = await sessionFor("ann@example.com");
      const op = await sessionFor("op@example.com");
      const annSocket = await open(createGatewayTicket(ann.id, clock.now(), SECRET));
      const opSocket = await open(createGatewayTicket(op.id, clock.now(), SECRET));

      await removeAllowlistEntry(db, "op@example.com", "ann@example.com", operators, notifyMemberRevoked(db));
      await expect.poll(() => annSocket.closeCode, { timeout: 2000 }).toBe(CloseCode.Revoked);
      expect(opSocket.closed).toBe(false);
      expect(hub.count("ann@example.com")).toBe(0);
    } finally {
      await stop();
    }
  });
});

describe("BrowserHub.notifyMember (#198)", () => {
  it("sends the event to every socket of that Member and to no one else", async () => {
    const ann = await sessionFor("ann@example.com");
    const bo = await sessionFor("bo@example.com");
    const received = async (sessionId: string) => {
      const browser = await open(createGatewayTicket(sessionId, clock.now(), SECRET));
      const messages: unknown[] = [];
      browser.onMessage((text) => messages.push(JSON.parse(text)));
      return messages;
    };
    const annTabs = [await received(ann.id), await received(ann.id)];
    const boTab = await received(bo.id);
    const event = { type: "notify", kind: "succeeded", runId: "r-1", ticketKey: "web#1", ticketTitle: "T", flowName: "F" } as const;

    hub.notifyMember("Ann@Example.com", event);
    await settle();
    for (const tab of annTabs) expect(tab).toEqual([event]);
    expect(boTab).toEqual([]);
  });
});
