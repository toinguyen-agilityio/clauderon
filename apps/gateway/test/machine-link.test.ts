import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getMachine, sql, type Db, type Machine } from "@clauderon/db";
import { CloseCode, controlMessage, serialize } from "@clauderon/protocol";
import { FakeAgent, FakeClock, createTestDatabase, machineRow, memberRow, memorySocketPair, settle, type TestDatabase } from "@clauderon/testing";
import { MachineLinks } from "../src/machine-link";

const TOKEN = "ann-machine-token";
let test: TestDatabase;
let db: Db;
let clock: FakeClock;
let links: MachineLinks;
let machine: Machine;

beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
});
afterAll(() => test.drop());
beforeEach(async () => {
  await db.execute(sql`truncate member, machine cascade`);
  const ann = await memberRow(db, "ann@example.com", "Ann");
  // Paired but not connected yet.
  machine = await machineRow(db, ann.id, { token: TOKEN, connected: false });
  clock = new FakeClock();
  links = new MachineLinks({ db, clock, log: () => {} });
  await links.start();
});

/** Lets in-flight messages arrive and the links finish their database work. */
async function flush() {
  for (let i = 0; i < 4; i++) {
    await settle();
    await links.idle();
  }
}

function connect(agent: FakeAgent, authorization = `Bearer ${TOKEN}`) {
  const [agentSide, gatewaySide] = memorySocketPair();
  links.attach(gatewaySide, authorization);
  agent.connect(agentSide);
  return agentSide;
}

describe("MachineLinks", () => {
  it("T0-13: marks the Machine connected with its token's facts and replies welcome", async () => {
    const agent = new FakeAgent();
    connect(agent);
    await flush();

    expect(agent.welcome).toEqual({ lastReceivedId: 0 });
    expect(await getMachine(db, machine.id)).toMatchObject({ connected: true, os: "darwin", arch: "arm64", hostname: "fake-mac", cpus: 8 });
    expect(links.connected(machine.id)).toBe(true);
  });

  it("T0-13: closes an unknown or missing token with 4401 and records nothing", async () => {
    for (const authorization of ["Bearer wrong", ""]) {
      const agent = new FakeAgent();
      connect(agent, authorization);
      await flush();
      expect(agent.closeCode).toBe(CloseCode.Unauthorized);
      expect(agent.welcome).toBeNull();
    }
    expect(await getMachine(db, machine.id)).toMatchObject({ connected: false, hostname: null });
  });

  it("marks the Machine disconnected when the socket closes", async () => {
    const agent = new FakeAgent();
    const socket = connect(agent);
    await flush();
    socket.cut();
    await flush();
    expect(await getMachine(db, machine.id)).toMatchObject({ connected: false });
    expect(links.connected(machine.id)).toBe(false);
  });

  it("records heartbeats on the fake clock", async () => {
    const agent = new FakeAgent();
    connect(agent);
    await flush();
    await clock.advance(10_000);
    agent.heartbeat();
    await flush();
    expect((await getMachine(db, machine.id))?.lastHeartbeatAt).toEqual(new Date("2026-11-16T09:00:10Z"));
  });

  it("keeps the usage a heartbeat carries, and the last one when a heartbeat has none", async () => {
    const agent = new FakeAgent();
    const socket = connect(agent);
    await flush();
    const usage = { memoryUsedMb: 15360, diskFreeGb: 65, cpuPercent: 13 };
    socket.send(serialize(controlMessage("heartbeat", { at: "now", usage })));
    await flush();
    expect((await getMachine(db, machine.id))?.usage).toEqual(usage);
    agent.heartbeat();
    await flush();
    expect((await getMachine(db, machine.id))?.usage).toEqual(usage);
  });

  it("stores usage without a disk reading as it is, so the web shows unknown, not 0", async () => {
    const agent = new FakeAgent();
    const socket = connect(agent);
    await flush();
    const usage = { memoryUsedMb: 100, cpuPercent: 5 };
    socket.send(serialize(controlMessage("heartbeat", { at: "now", usage })));
    await flush();
    const stored = (await getMachine(db, machine.id))?.usage;
    expect(stored).toEqual(usage);
    expect(stored?.diskFreeGb).toBeUndefined();
  });

  it("T0-14: a message dropped before it was acknowledged is delivered exactly once after reconnect", async () => {
    const agent = new FakeAgent();
    let socket = connect(agent);
    await flush();

    for (let n = 1; n <= 4; n++) links.send(machine.id, "node.kill", { attemptId: `a-${n}` });
    await flush();
    links.send(machine.id, "node.kill", { attemptId: "a-5" });
    socket.cut(); // message 5 is in flight and lost
    await flush();
    expect(agent.received.map((e) => e.id)).toEqual([1, 2, 3, 4]);

    socket = connect(agent);
    await flush();
    expect(agent.received.map((e) => e.id)).toEqual([1, 2, 3, 4, 5]);

    // Acknowledged now, so a further reconnect resends nothing.
    socket.cut();
    await flush();
    connect(agent);
    await flush();
    expect(agent.received.map((e) => e.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("T0-14: messages from the Agent are delivered once even when resent", async () => {
    const delivered: string[] = [];
    links.on("workspace.ready", (payload, machineId) => {
      expect(machineId).toBe(machine.id);
      delivered.push(payload.runId);
    });
    const agent = new FakeAgent();
    let socket = connect(agent);
    await flush();

    const a = agent.send("workspace.ready", { runId: "a", worktreePath: "/w/a" });
    await flush();
    socket.send(serialize(a)); // a duplicate is dropped
    agent.send("workspace.ready", { runId: "b", worktreePath: "/w/b" });
    socket.cut(); // b is lost in flight
    await flush();
    expect(delivered).toEqual(["a"]);

    socket = connect(agent);
    await flush();
    expect(delivered).toEqual(["a", "b"]);
    expect(agent.buffer.unacked(0)).toEqual([]);
  });

  it("a new Agent process starts a new sequence", async () => {
    const delivered: string[] = [];
    links.on("workspace.ready", (p) => {
      delivered.push(p.runId);
    });
    const first = new FakeAgent("process-1");
    const socket = connect(first);
    await flush();
    first.send("workspace.ready", { runId: "a", worktreePath: "/w/a" });
    await flush();
    socket.cut();
    await flush();

    const restarted = new FakeAgent("process-2");
    connect(restarted);
    await flush();
    expect(restarted.welcome?.lastReceivedId).toBe(0);
    restarted.send("workspace.ready", { runId: "b", worktreePath: "/w/b" });
    await flush();
    expect(delivered).toEqual(["a", "b"]);
  });

  it("acknowledges an unknown message type instead of failing (R10)", async () => {
    const agent = new FakeAgent();
    const agentSide = connect(agent);
    await flush();
    const acks: number[] = [];
    agentSide.onMessage((text) => {
      const msg = JSON.parse(text) as { type: string; payload: { upTo: number } };
      if (msg.type === "ack") acks.push(msg.payload.upTo);
    });
    agentSide.send(JSON.stringify({ id: 1, type: "machine.teleport", payload: {} }));
    agentSide.send(serialize(controlMessage("heartbeat", { at: "now" })));
    await flush();
    expect(acks).toEqual([1]);
    expect(agentSide.closed).toBe(false);
  });

  it("a restarted Gateway shows the Machine disconnected until the next hello", async () => {
    connect(new FakeAgent());
    await flush();
    expect((await getMachine(db, machine.id))?.connected).toBe(true);

    const restarted = new MachineLinks({ db, clock, log: () => {} });
    await restarted.start();
    expect((await getMachine(db, machine.id))?.connected).toBe(false);
  });

  it("a second connection of the same Machine replaces the first", async () => {
    const first = new FakeAgent();
    connect(first);
    await flush();
    const second = new FakeAgent();
    connect(second);
    await flush();
    expect(first.closeCode).toBe(CloseCode.Replaced);
    expect(second.welcome).not.toBeNull();
    expect(links.connected(machine.id)).toBe(true);
  });

  it("two Machines keep their own sockets and message ids", async () => {
    const bo = await memberRow(db, "bo@example.com", "Bo");
    const other = await machineRow(db, bo.id, { token: "bo-token", connected: false });
    const ann = new FakeAgent("ann-process");
    const boAgent = new FakeAgent("bo-process");
    connect(ann);
    connect(boAgent, "Bearer bo-token");
    await flush();

    links.send(machine.id, "node.kill", { attemptId: "ann-1" });
    links.send(other.id, "node.kill", { attemptId: "bo-1" });
    links.send(other.id, "node.kill", { attemptId: "bo-2" });
    await flush();
    expect(ann.received.map((e) => [e.id, (e.payload as { attemptId: string }).attemptId])).toEqual([[1, "ann-1"]]);
    expect(boAgent.received.map((e) => [e.id, (e.payload as { attemptId: string }).attemptId])).toEqual([
      [1, "bo-1"],
      [2, "bo-2"],
    ]);
    expect(await getMachine(db, other.id)).toMatchObject({ connected: true, lastSentId: 2 });
    expect(await getMachine(db, machine.id)).toMatchObject({ connected: true, lastSentId: 1 });
  });

  it("ADR 0006: pairing anew closes the old Agent with 4403, and its old token gets 4401", async () => {
    const old = new FakeAgent("old-process");
    connect(old);
    await flush();
    links.send(machine.id, "node.kill", { attemptId: "before" });
    await flush();

    // The web app gave the Machine a new token, then told the Gateway.
    await db.execute(sql`update machine set token_hash = ${"0".repeat(64)} where id = ${machine.id}`);
    await links.repaired(machine.id);
    await flush();
    expect(old.closeCode).toBe(CloseCode.Revoked);
    expect(links.connected(machine.id)).toBe(false);

    const retry = new FakeAgent("old-process");
    connect(retry);
    await flush();
    expect(retry.closeCode).toBe(CloseCode.Unauthorized);

    // The next Agent starts numbering from scratch.
    links.send(machine.id, "node.kill", { attemptId: "after" });
    expect(await getMachine(db, machine.id)).toMatchObject({ connected: false });
    await flush();
    expect((await getMachine(db, machine.id))?.lastSentId).toBe(1);
  });
});
