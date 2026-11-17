import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createSession, schema, sql, type Db } from "@clauderon/db";
import { CloseCode, createGatewayTicket } from "@clauderon/protocol";
import { createTestDatabase, memberRow, memorySocketPair, podRow, type MemorySocket, type TestDatabase } from "@clauderon/testing";
import { SESSION_SECRET, startGateway } from "./harness";

let test: TestDatabase;
let db: Db;
const operators = ["ann@example.com", "bob@example.com"];

beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
});
afterAll(() => test.drop());
beforeEach(async () => {
  await db.execute(sql`truncate member, pod, audit_entry, session, pod_host cascade`);
});

async function setup() {
  const ann = await memberRow(db, "ann@example.com");
  const bob = await memberRow(db, "bob@example.com");
  const pod = await podRow(db, ann.id);
  const ctx = await startGateway(db, operators);
  const ticketFor = async (memberId: string, token: string) => {
    const s = await createSession(db, memberId, token, ctx.clock.now());
    return createGatewayTicket(s.id, ctx.clock.now(), SESSION_SECRET);
  };
  const open = async (memberId: string, token: string) => {
    const [browser, server] = memorySocketPair();
    const out: string[] = [];
    browser.onMessage((text) => out.push(text));
    const ticket = await ticketFor(memberId, token);
    const attaching = ctx.gateway.terminals.attach(server, ticket, pod.id, { cols: 100, rows: 30 });
    // The browser sends a resize as soon as the socket opens, before the session is checked.
    browser.send(JSON.stringify({ type: "resize", cols: 120, rows: 40 }));
    const sessionId = await attaching;
    await ctx.flush();
    return { browser, sessionId, out };
  };
  return { ann, bob, pod, open, ticketFor, ...ctx };
}

const audit = async () => (await db.select().from(schema.auditEntry)).map((a) => ({ action: a.action, detail: a.detail }));

describe("Web terminal (POD-9)", () => {
  it("T1-3: a Member who is not the owner has their terminal socket refused", async () => {
    const { bob, open, agent } = await setup();
    const { browser, sessionId } = await open(bob.id, "bob-cookie");
    expect(sessionId).toBeNull();
    expect((browser as MemorySocket).closeCode).toBe(CloseCode.NotFound);
    expect(agent.of("terminal.open")).toEqual([]);
  });

  it("relays keystrokes, resize and output between the browser and the Host Agent", async () => {
    const { ann, pod, open, agent, flush } = await setup();
    const { browser, sessionId, out } = await open(ann.id, "ann-cookie");
    expect(agent.of("terminal.open")).toEqual([{ sessionId, podId: pod.id, cols: 100, rows: 30 }]);
    expect(agent.of("terminal.resize")).toEqual([{ sessionId, podId: pod.id, cols: 120, rows: 40 }]);

    browser.send(JSON.stringify({ type: "input", data: "gh auth login\r" }));
    agent.send("terminal.output", { sessionId: sessionId!, data: "! First copy your one-time code" });
    await flush();
    expect(agent.of("terminal.input")).toEqual([{ sessionId, podId: pod.id, data: "gh auth login\r" }]);
    expect(out.map((t) => JSON.parse(t))).toEqual([{ type: "output", data: "! First copy your one-time code" }]);
  });

  it("T1-4: closing the terminal sends terminal.close then pod.checkLogins; audit has open and close, no keystrokes", async () => {
    const { ann, pod, open, agent, flush } = await setup();
    // No terminal.closed reply: the audit and the check must not wait for the Host Agent.
    const { browser, sessionId } = await open(ann.id, "ann-cookie");
    browser.send(JSON.stringify({ type: "input", data: "secret-keystrokes" }));
    await flush();
    browser.close();
    await flush();

    expect(agent.of("terminal.close")).toEqual([{ sessionId, podId: pod.id }]);
    expect(agent.of("pod.checkLogins")).toEqual([{ podId: pod.id }]);
    const entries = await audit();
    expect(entries.map((e) => e.action)).toEqual(["terminal.open", "terminal.close"]);
    expect(entries[1]!.detail).toEqual({ sessionId, startedAt: expect.any(String), endedAt: expect.any(String) });
    expect(JSON.stringify(entries)).not.toContain("secret-keystrokes");
  });

  it("T1-6: removing the owner's email closes their terminal and live log sockets at once", async () => {
    const { ann, open, agent, gateway, ticketFor, flush } = await setup();
    const { browser } = await open(ann.id, "ann-cookie");
    const [logs, logsServer] = memorySocketPair();
    await gateway.hub.attach(logsServer, await ticketFor(ann.id, "ann-cookie-2"));

    gateway.hub.revoke("ann@example.com");
    await flush();
    expect((browser as MemorySocket).closeCode).toBe(CloseCode.Revoked);
    expect((logs as MemorySocket).closeCode).toBe(CloseCode.Revoked);
    expect(agent.of("terminal.close")).toHaveLength(1);
  });
});

describe("Pod commands (POD-2, POD-6)", () => {
  it("T1-1: pod.create from the web app is sent with the row's image and 2 CPU / 4096 MB", async () => {
    const { pod, gateway, agent, flush } = await setup();
    await gateway.pods.command({ type: "pod.create", podId: pod.id });
    await flush();
    expect(agent.of("pod.create")).toEqual([{ podId: pod.id, image: "ghcr.io/acme/clauderon-pod:test", cpus: 2, memoryMb: 4096 }]);
  });

  it("a Pod that starts running gets a login check and records the image digest", async () => {
    const { pod, agent, flush } = await setup();
    await db.update(schema.pod).set({ status: "stopped" });
    agent.send("pod.status", { podId: pod.id, status: "running", containerId: "cid", imageDigest: "sha256:abc" });
    await flush();
    expect(agent.of("pod.checkLogins")).toEqual([{ podId: pod.id }]);
    const [row] = await db.select().from(schema.pod);
    expect(row).toMatchObject({ status: "running", containerId: "cid", imageDigest: "sha256:abc" });
  });
});
