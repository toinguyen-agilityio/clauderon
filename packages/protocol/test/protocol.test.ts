import { describe, expect, it } from "vitest";
import { ResumeBuffer, browserRequest, controlMessage, createGatewayTicket, parseBrowserMessage, parseEnvelope, serialize, verifyGatewayTicket } from "../src/index";

describe("gateway ticket", () => {
  const now = new Date("2026-11-16T09:00:00Z");
  it("names the session until it expires", () => {
    const ticket = createGatewayTicket("s-1", now, "secret");
    expect(verifyGatewayTicket(ticket, new Date(now.getTime() + 59_000), "secret")).toBe("s-1");
    expect(verifyGatewayTicket(ticket, new Date(now.getTime() + 61_000), "secret")).toBeNull();
  });

  it("refuses a ticket signed with another secret or tampered with", () => {
    const ticket = createGatewayTicket("s-1", now, "secret");
    expect(verifyGatewayTicket(ticket, now, "other")).toBeNull();
    const forged = createGatewayTicket("s-2", now, "secret").split(".")[0] + "." + ticket.split(".")[1];
    expect(verifyGatewayTicket(forged, now, "secret")).toBeNull();
    expect(verifyGatewayTicket("garbage", now, "secret")).toBeNull();
  });
});

const hello = {
  agentVersion: "0.1.0",
  processId: "p-1",
  os: "darwin",
  arch: "arm64",
  hostname: "ann-mac",
  cpus: 8,
  memoryMb: 16384,
  diskGb: 500,
  lastReceivedId: 0,
  liveAttempts: [],
};

describe("parseEnvelope", () => {
  it("validates the payload against the schema for its type", () => {
    const parsed = parseEnvelope(serialize(controlMessage("hello", hello)));
    expect(parsed).toEqual({ ok: true, known: true, envelope: { id: 0, type: "hello", payload: hello } });

    const bad = parseEnvelope(JSON.stringify({ id: 0, type: "hello", payload: { ...hello, cpus: "eight" } }));
    expect(bad.ok).toBe(false);
  });

  it("accepts an unknown type as known: false instead of failing (R10)", () => {
    const parsed = parseEnvelope(JSON.stringify({ id: 3, type: "machine.teleport", payload: { anything: 1 } }));
    expect(parsed).toEqual({ ok: true, known: false, envelope: { id: 3, type: "machine.teleport", payload: { anything: 1 } } });
  });

  it("rejects text that is not an envelope", () => {
    expect(parseEnvelope("not json").ok).toBe(false);
    expect(parseEnvelope(JSON.stringify({ type: "ack" })).ok).toBe(false);
  });

  it("knows the messages of later milestones so the protocol is frozen", () => {
    const parsed = parseEnvelope(
      JSON.stringify({ id: 9, type: "node.result", payload: { attemptId: "a1", exitCode: 0, result: { outputs: { plan: "x" } } } }),
    );
    expect(parsed).toMatchObject({ ok: true, known: true });
  });
});

describe("ResumeBuffer", () => {
  it("numbers messages from 1 and keeps them until acknowledged", () => {
    const buffer = new ResumeBuffer();
    const sent = [1, 2, 3].map((n) => buffer.next("node.kill", { attemptId: `a${n}` }));
    expect(sent.map((e) => e.id)).toEqual([1, 2, 3]);
    buffer.acknowledge(2);
    expect(buffer.unacked(0).map((e) => e.id)).toEqual([3]);
  });

  it("resends only what the other side has not received", () => {
    const buffer = new ResumeBuffer();
    for (let n = 1; n <= 5; n++) buffer.next("node.kill", { attemptId: `a${n}` });
    buffer.acknowledge(3);
    expect(buffer.unacked(4).map((e) => e.id)).toEqual([5]);
  });

  it("delivers each received id once and in order", () => {
    const buffer = new ResumeBuffer();
    const env = (id: number) => ({ id, type: "node.kill", payload: {} });
    expect(buffer.accept(env(1))).toBe("deliver");
    expect(buffer.accept(env(1))).toBe("duplicate");
    expect(buffer.accept(env(2))).toBe("deliver");
    expect(buffer.lastReceivedId).toBe(2);
  });

  it("delivers past a gap a restarted sender can no longer fill, so the link never stalls", () => {
    const buffer = new ResumeBuffer({ lastReceivedId: 4 });
    const env = (id: number) => ({ id, type: "node.kill", payload: {} });
    expect(buffer.accept(env(9))).toBe("gap");
    expect(buffer.lastReceivedId).toBe(9);
    expect(buffer.accept(env(10))).toBe("deliver");
    expect(buffer.accept(env(5))).toBe("duplicate");
  });

  it("starts from persisted ids", () => {
    const buffer = new ResumeBuffer({ lastSentId: 7, lastReceivedId: 4 });
    expect(buffer.next("ack", { upTo: 1 }).id).toBe(8);
    expect(buffer.accept({ id: 4, type: "x", payload: {} })).toBe("duplicate");
  });
});

describe("heartbeat usage", () => {
  const parse = (payload: object) => parseEnvelope(serialize(controlMessage("heartbeat", payload as never)));
  it("parses with free disk, without it (disk unreadable) and without usage (older Agent)", () => {
    expect(parse({ at: "now", usage: { memoryUsedMb: 1, diskFreeGb: 65, cpuPercent: 3 } }).ok).toBe(true);
    expect(parse({ at: "now", usage: { memoryUsedMb: 1, cpuPercent: 3 } }).ok).toBe(true);
    expect(parse({ at: "now" }).ok).toBe(true);
  });
});

describe("browser requests (#197)", () => {
  it("accepts subscribe.needs and still refuses an unknown type", () => {
    expect(parseBrowserMessage(browserRequest, JSON.stringify({ type: "subscribe.needs" }))).toEqual({ type: "subscribe.needs" });
    expect(parseBrowserMessage(browserRequest, JSON.stringify({ type: "subscribe.everything" }))).toBeNull();
  });
});
