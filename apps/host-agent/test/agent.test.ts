import { beforeEach, describe, expect, it } from "vitest";
import { CloseCode, controlMessage, parseEnvelope, serialize, type Envelope, type LinkSocket } from "@clauderon/protocol";
import { FakeClock, memorySocketPair, settle, type MemorySocket } from "@clauderon/testing";
import { Agent, type Connector, type MachineFactsReader, type StateStore } from "../src/agent";

const facts: MachineFactsReader = async () => ({ os: "darwin", arch: "arm64", hostname: "ann-mac", cpus: 10, memoryMb: 32768, diskGb: 994 });

class MemoryState implements StateStore {
  constructor(public lastReceivedId = 0) {}
  async load() {
    return { lastReceivedId: this.lastReceivedId };
  }
  async save(state: { lastReceivedId: number }) {
    this.lastReceivedId = state.lastReceivedId;
  }
}

/** Plays the Gateway: one memory socket per accepted connection. */
class FakeGateway {
  sockets: MemorySocket[] = [];
  inbox: Envelope[][] = [];
  refuse = false;
  attempts = 0;

  connector: Connector = async (url, headers) => {
    this.attempts++;
    expect(url).toBe("ws://gateway.test/agent");
    expect(headers.authorization).toBe("Bearer machine-token");
    if (this.refuse) throw new Error("connection refused");
    const [agentSide, gatewaySide] = memorySocketPair();
    const inbox: Envelope[] = [];
    gatewaySide.onMessage((text) => {
      const parsed = parseEnvelope(text);
      if (parsed.ok) inbox.push(parsed.envelope);
    });
    this.sockets.push(gatewaySide);
    this.inbox.push(inbox);
    return agentSide satisfies LinkSocket;
  };

  get socket(): MemorySocket {
    return this.sockets.at(-1)!;
  }

  get received(): Envelope[] {
    return this.inbox.at(-1)!;
  }

  welcome(lastReceivedId = 0) {
    this.socket.send(serialize(controlMessage("welcome", { lastReceivedId })));
  }
}

let clock: FakeClock;
let gateway: FakeGateway;
let state: MemoryState;
let agent: Agent;

beforeEach(() => {
  clock = new FakeClock();
  gateway = new FakeGateway();
  state = new MemoryState(7);
  agent = new Agent({
    url: "ws://gateway.test",
    token: "machine-token",
    clock,
    connect: gateway.connector,
    facts,
    state,
    processId: "proc-1",
    version: "0.1.0",
    log: () => {},
  });
});

describe("Agent", () => {
  it("sends hello with the Machine's facts and the stored last received id", async () => {
    await agent.start();
    await settle();
    expect(gateway.received[0]).toEqual({
      id: 0,
      type: "hello",
      payload: {
        agentVersion: "0.1.0",
        processId: "proc-1",
        os: "darwin",
        arch: "arm64",
        hostname: "ann-mac",
        cpus: 10,
        memoryMb: 32768,
        diskGb: 994,
        lastReceivedId: 7,
        liveAttempts: [],
      },
    });
  });

  it("sends a heartbeat every 10 seconds once welcomed", async () => {
    await agent.start();
    await settle();
    gateway.welcome();
    await settle();
    await clock.advance(30_000);
    expect(gateway.received.filter((e) => e.type === "heartbeat")).toHaveLength(3);
  });

  it("sends the Machine's usage with each heartbeat, and a bare heartbeat when reading it fails", async () => {
    const usage = { memoryUsedMb: 15360, diskFreeGb: 65, cpuPercent: 13 };
    let fail = false;
    agent = new Agent({
      url: "ws://gateway.test",
      token: "machine-token",
      clock,
      connect: gateway.connector,
      facts,
      usage: async () => {
        if (fail) throw new Error("statfs failed");
        return usage;
      },
      state,
      processId: "proc-1",
      version: "0.1.0",
      log: () => {},
    });
    await agent.start();
    await settle();
    gateway.welcome();
    await settle();
    await clock.advance(10_000);
    await settle();
    fail = true;
    await clock.advance(10_000);
    await settle();
    const beats = gateway.received.filter((e) => e.type === "heartbeat").map((e) => e.payload as { usage?: unknown });
    expect(beats.map((b) => b.usage)).toEqual([usage, undefined]);
  });

  it("delivers a numbered message once, acknowledges it and stores its id", async () => {
    const got: string[] = [];
    agent.on("node.kill", (p) => {
      got.push(p.attemptId);
    });
    await agent.start();
    await settle();
    gateway.welcome();
    const msg = { id: 8, type: "node.kill", payload: { attemptId: "att-1" } };
    gateway.socket.send(JSON.stringify(msg));
    gateway.socket.send(JSON.stringify(msg));
    await settle();

    expect(got).toEqual(["att-1"]);
    expect(state.lastReceivedId).toBe(8);
    expect(gateway.received.filter((e) => e.type === "ack").map((e) => e.payload)).toEqual([{ upTo: 8 }, { upTo: 8 }]);
  });

  it("acknowledges an unknown message type instead of failing (R10)", async () => {
    await agent.start();
    await settle();
    gateway.welcome();
    gateway.socket.send(JSON.stringify({ id: 8, type: "machine.teleport", payload: {} }));
    await settle();
    expect(gateway.received.at(-1)).toEqual({ id: 0, type: "ack", payload: { upTo: 8 } });
  });

  it("resends what the Gateway has not received after a reconnect", async () => {
    await agent.start();
    await settle();
    gateway.welcome();
    await settle();
    agent.send("workspace.ready", { runId: "a", worktreePath: "/w/a" });
    agent.send("workspace.ready", { runId: "b", worktreePath: "/w/b" });
    gateway.socket.cut();
    await settle();

    await clock.advance(1000);
    gateway.welcome(1); // the Gateway had received message 1 only
    await settle();
    expect(gateway.received.filter((e) => e.id > 0).map((e) => e.id)).toEqual([2]);
  });

  it("T0-15: reconnects with backoff 1, 2, 4, 8 s capped at 10 s, forever", async () => {
    gateway.refuse = true;
    await agent.start();
    await settle();
    const delays: number[] = [];
    for (let i = 0; i < 7; i++) {
      delays.push(clock.pending()[0]!);
      await clock.advance(delays.at(-1)!);
    }
    expect(delays).toEqual([1000, 2000, 4000, 8000, 10000, 10000, 10000]);
    expect(gateway.attempts).toBe(8);
  });

  it("starts the backoff again after a welcome", async () => {
    gateway.refuse = true;
    await agent.start();
    await settle();
    await clock.advance(1000);
    await clock.advance(2000);
    gateway.refuse = false;
    await clock.advance(4000);
    gateway.welcome();
    await settle();
    gateway.socket.cut();
    await settle();
    expect(clock.pending()).toEqual([1000]);
  });

  it("stops heartbeats while disconnected", async () => {
    await agent.start();
    await settle();
    gateway.welcome();
    await settle();
    gateway.socket.cut();
    await settle();
    gateway.refuse = true;
    const before = gateway.inbox.flat().filter((e) => e.type === "heartbeat").length;
    await clock.advance(30_000);
    expect(gateway.inbox.flat().filter((e) => e.type === "heartbeat").length).toBe(before);
  });

  it("RUN-12: hello lists running Attempts and those with an unacknowledged result", async () => {
    agent = new Agent({
      url: "ws://gateway.test",
      token: "machine-token",
      clock,
      connect: gateway.connector,
      facts,
      state,
      processId: "proc-1",
      version: "0.1.0",
      log: () => {},
      runningAttempts: () => ["att-running"],
    });
    await agent.start();
    await settle();
    gateway.welcome();
    await settle();
    agent.send("node.result", { attemptId: "att-done", exitCode: 0 });

    gateway.socket.cut();
    await settle();
    await clock.advance(1000);
    expect((gateway.received[0]!.payload as { liveAttempts: string[] }).liveAttempts.sort()).toEqual(["att-done", "att-running"]);
  });

  it("RUN-12: runs onWelcome after every welcome, e.g. the orphan sweep", async () => {
    let sweeps = 0;
    agent = new Agent({
      url: "ws://gateway.test",
      token: "machine-token",
      clock,
      connect: gateway.connector,
      facts,
      state,
      processId: "proc-1",
      version: "0.1.0",
      log: () => {},
      onWelcome: () => {
        sweeps++;
      },
    });
    await agent.start();
    await settle();
    gateway.welcome();
    await settle();
    gateway.socket.cut();
    await settle();
    await clock.advance(1000);
    gateway.welcome();
    await settle();
    expect(sweeps).toBe(2);
  });

  it("ADR 0006: a refused or replaced token stops the Agent instead of reconnecting", async () => {
    for (const code of [CloseCode.Unauthorized, CloseCode.Revoked]) {
      const unpaired: number[] = [];
      gateway = new FakeGateway();
      agent = new Agent({
        url: "ws://gateway.test",
        token: "machine-token",
        clock,
        connect: gateway.connector,
        facts,
        state,
        processId: "proc-1",
        version: "0.1.0",
        log: () => {},
        onUnpaired: (c) => void unpaired.push(c),
      });
      await agent.start();
      await settle();
      gateway.socket.close(code);
      await settle();
      await clock.advance(60_000);
      expect(unpaired).toEqual([code]);
      expect(gateway.attempts).toBe(1);
    }
  });

  it("a link that ends without a close code stops the Agent when the Gateway no longer knows its token", async () => {
    const unpaired: number[] = [];
    let known = true;
    agent = new Agent({
      url: "ws://gateway.test",
      token: "machine-token",
      clock,
      connect: gateway.connector,
      facts,
      state,
      processId: "proc-1",
      version: "0.1.0",
      log: () => {},
      onUnpaired: (c) => void unpaired.push(c),
      isUnpaired: async () => !known,
    });
    await agent.start();
    await settle();
    // Still paired: a lost connection is retried as before.
    gateway.socket.close(1006);
    await settle();
    await clock.advance(1_000);
    expect(gateway.attempts).toBe(2);
    expect(unpaired).toEqual([]);
    // Unpaired or removed: the refusal's code never arrived, but the check says so.
    known = false;
    gateway.socket.close(1006);
    await settle();
    await clock.advance(60_000);
    expect(unpaired).toEqual([CloseCode.Unauthorized]);
    expect(gateway.attempts).toBe(2);
  });

  it("a link that dropped after its welcome is retried without asking whether the token is still paired", async () => {
    let asked = 0;
    agent = new Agent({
      url: "ws://gateway.test",
      token: "machine-token",
      clock,
      connect: gateway.connector,
      facts,
      state,
      processId: "proc-1",
      version: "0.1.0",
      log: () => {},
      isUnpaired: async () => {
        asked++;
        return true;
      },
    });
    await agent.start();
    await settle();
    gateway.welcome();
    await settle();
    gateway.socket.close(1006);
    await settle();
    await clock.advance(1_000);
    expect(asked).toBe(0);
    expect(gateway.attempts).toBe(2);
  });
});
