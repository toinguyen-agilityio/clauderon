import { beforeEach, describe, expect, it } from "vitest";
import { controlMessage, parseEnvelope, serialize, type Envelope, type LinkSocket } from "@clauderon/protocol";
import { FakeClock, memorySocketPair, settle, type MemorySocket } from "@clauderon/testing";
import { HostAgent, type Connector, type HostFactsReader, type StateStore } from "../src/agent.js";

const facts: HostFactsReader = async () => ({ arch: "arm64", cpus: 10, memoryMb: 32768, diskGb: 994, dockerRunning: true });

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
    expect(url).toBe("ws://gateway.test/host-agent");
    expect(headers.authorization).toBe("Bearer s3cret");
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
    this.socket.send(serialize(controlMessage("welcome", { lastReceivedId, podImage: "img" })));
  }
}

let clock: FakeClock;
let gateway: FakeGateway;
let state: MemoryState;
let agent: HostAgent;

beforeEach(() => {
  clock = new FakeClock();
  gateway = new FakeGateway();
  state = new MemoryState(7);
  agent = new HostAgent({
    url: "ws://gateway.test",
    secret: "s3cret",
    clock,
    connect: gateway.connector,
    facts,
    state,
    processId: "proc-1",
    version: "0.1.0",
    log: () => {},
  });
});

describe("HostAgent", () => {
  it("sends hello with host facts and the stored last received id", async () => {
    await agent.start();
    await settle();
    expect(gateway.received[0]).toEqual({
      id: 0,
      type: "hello",
      payload: {
        agentVersion: "0.1.0",
        processId: "proc-1",
        arch: "arm64",
        cpus: 10,
        memoryMb: 32768,
        diskGb: 994,
        dockerRunning: true,
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

  it("delivers a numbered message once, acknowledges it and stores its id", async () => {
    const got: string[] = [];
    agent.on("pod.checkLogins", (p) => {
      got.push(p.podId);
    });
    await agent.start();
    await settle();
    gateway.welcome();
    const msg = { id: 8, type: "pod.checkLogins", payload: { podId: "pod-1" } };
    gateway.socket.send(JSON.stringify(msg));
    gateway.socket.send(JSON.stringify(msg));
    await settle();

    expect(got).toEqual(["pod-1"]);
    expect(state.lastReceivedId).toBe(8);
    expect(gateway.received.filter((e) => e.type === "ack").map((e) => e.payload)).toEqual([{ upTo: 8 }, { upTo: 8 }]);
  });

  it("acknowledges an unknown message type instead of failing (R10)", async () => {
    await agent.start();
    await settle();
    gateway.welcome();
    gateway.socket.send(JSON.stringify({ id: 8, type: "pod.teleport", payload: {} }));
    await settle();
    expect(gateway.received.at(-1)).toEqual({ id: 0, type: "ack", payload: { upTo: 8 } });
  });

  it("resends what the Gateway has not received after a reconnect", async () => {
    await agent.start();
    await settle();
    gateway.welcome();
    await settle();
    agent.send("pod.status", { podId: "a", status: "running", containerId: null, imageDigest: null });
    agent.send("pod.status", { podId: "b", status: "running", containerId: null, imageDigest: null });
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
});
