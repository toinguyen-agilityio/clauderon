import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { getPodHost, type Db } from "@clauderon/db";
import { CloseCode, controlMessage, serialize } from "@clauderon/protocol";
import { FakeClock, createTestDatabase, type TestDatabase } from "@clauderon/testing";
import { BrowserHub } from "../src/browser-hub";
import { HostLink } from "../src/host-link";
import { createGatewayServer } from "../src/server";

let test: TestDatabase;
let db: Db;
let server: Server;
let base: string;

beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
  const clock = new FakeClock();
  const link = new HostLink({ db, secret: "s3cret", podImage: "img", clock, log: () => {} });
  await link.start();
  const hub = new BrowserHub({ db, operators: [], sessionSecret: "x", clock });
  server = createGatewayServer(link, hub);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await test.drop();
});

const hello = controlMessage("hello", {
  agentVersion: "0.1.0",
  processId: "p",
  arch: "x64",
  cpus: 4,
  memoryMb: 8192,
  diskGb: 100,
  dockerRunning: false,
  lastReceivedId: 0,
  liveAttempts: [],
});

describe("Gateway server over real WebSockets", () => {
  it("T0-13: a Host Agent with the right secret gets welcome and shows as connected", async () => {
    const ws = new WebSocket(`${base}/host-agent`, { headers: { authorization: "Bearer s3cret" } });
    const first = new Promise<string>((resolve) => ws.once("message", (data) => resolve(String(data))));
    await new Promise((resolve) => ws.once("open", resolve));
    ws.send(serialize(hello));
    expect(JSON.parse(await first)).toMatchObject({ id: 0, type: "welcome", payload: { lastReceivedId: 0, podImage: "img" } });
    expect(await getPodHost(db)).toMatchObject({ connected: true, arch: "x64" });
    ws.close();
  });

  it("T0-13: a wrong secret is closed with 4401", async () => {
    const ws = new WebSocket(`${base}/host-agent`, { headers: { authorization: "Bearer nope" } });
    const code = await new Promise<number>((resolve) => ws.once("close", resolve));
    expect(code).toBe(CloseCode.Unauthorized);
  });

  it("a browser socket without a ticket is closed with 4401", async () => {
    const ws = new WebSocket(`${base}/browser`);
    const code = await new Promise<number>((resolve) => ws.once("close", resolve));
    expect(code).toBe(CloseCode.Unauthorized);
  });

  it("answers the health check", async () => {
    const res = await fetch(`${base.replace("ws", "http")}/health`);
    expect(await res.json()).toEqual({ ok: true, hostAgentConnected: expect.any(Boolean) });
  });
});
