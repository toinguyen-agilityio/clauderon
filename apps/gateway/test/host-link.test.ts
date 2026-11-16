import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPodHost, sql, type Db } from "@clauderon/db";
import { CloseCode, controlMessage, serialize } from "@clauderon/protocol";
import { FakeClock, FakeHostAgent, createTestDatabase, memorySocketPair, settle, type TestDatabase } from "@clauderon/testing";
import { HostLink } from "../src/host-link";

const SECRET = "host-agent-secret";
let test: TestDatabase;
let db: Db;
let clock: FakeClock;
let link: HostLink;

beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
});
afterAll(() => test.drop());
beforeEach(async () => {
  await db.execute(sql`truncate pod_host`);
  clock = new FakeClock();
  link = new HostLink({ db, secret: SECRET, podImage: "ghcr.io/acme/clauderon-pod:2026-11-16", clock, log: () => {} });
  await link.start();
});

/** Lets in-flight messages arrive and the link finish its database work. */
async function flush() {
  for (let i = 0; i < 4; i++) {
    await settle();
    await link.idle();
  }
}

function connect(agent: FakeHostAgent, authorization = `Bearer ${SECRET}`) {
  const [agentSide, gatewaySide] = memorySocketPair();
  link.attach(gatewaySide, authorization);
  agent.connect(agentSide);
  return agentSide;
}

describe("HostLink", () => {
  it("T0-13: marks the Host Agent connected with the right secret and replies welcome", async () => {
    const agent = new FakeHostAgent();
    connect(agent);
    await flush();

    expect(agent.welcome).toEqual({ lastReceivedId: 0, podImage: "ghcr.io/acme/clauderon-pod:2026-11-16" });
    expect(await getPodHost(db)).toMatchObject({ connected: true, arch: "arm64", cpus: 8, dockerRunning: true });
    expect(link.connected).toBe(true);
  });

  it("T0-13: closes a wrong secret with 4401 and records nothing", async () => {
    const agent = new FakeHostAgent();
    connect(agent, "Bearer wrong");
    await flush();

    expect(agent.closeCode).toBe(CloseCode.Unauthorized);
    expect(agent.welcome).toBeNull();
    expect(await getPodHost(db)).toBeNull();
  });

  it("marks the Host Agent disconnected when the socket closes", async () => {
    const agent = new FakeHostAgent();
    const socket = connect(agent);
    await flush();
    socket.cut();
    await flush();
    expect(await getPodHost(db)).toMatchObject({ connected: false });
    expect(link.connected).toBe(false);
  });

  it("records heartbeats on the fake clock", async () => {
    const agent = new FakeHostAgent();
    connect(agent);
    await flush();
    await clock.advance(10_000);
    agent.heartbeat();
    await flush();
    expect((await getPodHost(db))?.lastHeartbeatAt).toEqual(new Date("2026-11-16T09:00:10Z"));
  });

  it("T0-14: a message dropped before it was acknowledged is delivered exactly once after reconnect", async () => {
    const agent = new FakeHostAgent();
    let socket = connect(agent);
    await flush();

    for (let n = 1; n <= 4; n++) link.send("pod.checkLogins", { podId: `pod-${n}` });
    await flush();
    link.send("pod.checkLogins", { podId: "pod-5" });
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

  it("T0-14: messages from the Host Agent are delivered once even when resent", async () => {
    const delivered: string[] = [];
    link.on("pod.status", (payload) => {
      delivered.push(payload.podId);
    });
    const agent = new FakeHostAgent();
    let socket = connect(agent);
    await flush();

    const a = agent.send("pod.status", { podId: "a", status: "running", containerId: "c1", imageDigest: null });
    await flush();
    socket.send(serialize(a)); // a duplicate is dropped
    agent.send("pod.status", { podId: "b", status: "running", containerId: "c2", imageDigest: null });
    socket.cut(); // b is lost in flight
    await flush();
    expect(delivered).toEqual(["a"]);

    socket = connect(agent);
    await flush();
    expect(delivered).toEqual(["a", "b"]);
    expect(agent.buffer.unacked(0)).toEqual([]);
  });

  it("a new Host Agent process starts a new sequence", async () => {
    const delivered: string[] = [];
    link.on("pod.status", (p) => {
      delivered.push(p.podId);
    });
    const first = new FakeHostAgent("process-1");
    const socket = connect(first);
    await flush();
    first.send("pod.status", { podId: "a", status: "running", containerId: null, imageDigest: null });
    await flush();
    socket.cut();
    await flush();

    const restarted = new FakeHostAgent("process-2");
    connect(restarted);
    await flush();
    expect(restarted.welcome?.lastReceivedId).toBe(0);
    restarted.send("pod.status", { podId: "b", status: "running", containerId: null, imageDigest: null });
    await flush();
    expect(delivered).toEqual(["a", "b"]);
  });

  it("acknowledges an unknown message type instead of failing (R10)", async () => {
    const agent = new FakeHostAgent();
    const [agentSide, gatewaySide] = memorySocketPair();
    link.attach(gatewaySide, `Bearer ${SECRET}`);
    agent.connect(agentSide);
    await flush();
    const acks: number[] = [];
    agentSide.onMessage((text) => {
      const msg = JSON.parse(text) as { type: string; payload: { upTo: number } };
      if (msg.type === "ack") acks.push(msg.payload.upTo);
    });
    agentSide.send(JSON.stringify({ id: 1, type: "pod.teleport", payload: {} }));
    agentSide.send(serialize(controlMessage("heartbeat", { at: "now", pods: [] })));
    await flush();
    expect(acks).toEqual([1]);
    expect(agentSide.closed).toBe(false);
  });

  it("a restarted Gateway shows the Pod Host disconnected until the next hello", async () => {
    connect(new FakeHostAgent());
    await flush();
    expect((await getPodHost(db))?.connected).toBe(true);

    const restarted = new HostLink({ db, secret: SECRET, podImage: "img", clock, log: () => {} });
    await restarted.start();
    expect((await getPodHost(db))?.connected).toBe(false);
  });

  it("a second connection replaces the first", async () => {
    const first = new FakeHostAgent();
    connect(first);
    await flush();
    const second = new FakeHostAgent();
    connect(second);
    await flush();
    expect(first.closeCode).toBe(CloseCode.Replaced);
    expect(second.welcome).not.toBeNull();
    expect(link.connected).toBe(true);
  });
});
