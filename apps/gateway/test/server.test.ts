import { createHash, randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { approvePairing, getMachineOfMember, type Db } from "@clauderon/db";
import { CloseCode, controlMessage, serialize, type PairResponse } from "@clauderon/protocol";
import { FakeClock, createTestDatabase, memberRow, type TestDatabase } from "@clauderon/testing";
import { BrowserHub } from "../src/browser-hub";
import { MachineLinks } from "../src/machine-link";
import { createGatewayServer } from "../src/server";

let test: TestDatabase;
let db: Db;
let clock: FakeClock;
let server: Server;
let http: string;
let ws: string;

beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
  clock = new FakeClock();
  const links = new MachineLinks({ db, clock, log: () => {} });
  await links.start();
  const hub = new BrowserHub({ db, operators: [], sessionSecret: "x", clock });
  server = createGatewayServer({ db, clock, links, hub, webUrl: "https://app.test/", log: () => {} });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  http = `http://127.0.0.1:${port}`;
  ws = `ws://127.0.0.1:${port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await test.drop();
});

const hello = controlMessage("hello", {
  agentVersion: "0.1.0",
  processId: "p",
  os: "linux",
  arch: "x64",
  hostname: "ann-laptop",
  cpus: 4,
  memoryMb: 8192,
  diskGb: 100,
  lastReceivedId: 0,
  liveAttempts: [],
});

function pair(body: unknown) {
  return fetch(`${http}/pair`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

function status(pairingId: string, token: string) {
  return fetch(`${http}/pair/${pairingId}`, { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json());
}

describe("Gateway server over real HTTP and WebSockets", () => {
  it("ADR 0006: pairs an Agent end to end: code, approval, then the token opens /agent", async () => {
    const ann = await memberRow(db, "ann@example.com", "Ann");
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const res = await pair({ tokenHash, hostname: "ann-laptop", os: "linux", arch: "x64" });
    expect(res.status).toBe(201);
    const { pairingId, code, approveUrl } = (await res.json()) as PairResponse;
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    // The Agent opens this page so the Member only has to press Approve.
    expect(approveUrl).toBe(`https://app.test/pair?code=${code}`);
    expect(await status(pairingId, token)).toEqual({ status: "pending" });
    // Someone who only knows the id learns nothing.
    expect(await status(pairingId, "not-the-token")).toEqual({ status: "expired" });

    expect(await approvePairing(db, ann, code, clock.now())).toMatchObject({ ok: true, replaced: false });
    expect(await status(pairingId, token)).toEqual({ status: "approved" });

    const socket = new WebSocket(`${ws}/agent`, { headers: { authorization: `Bearer ${token}` } });
    const first = new Promise<string>((resolve) => socket.once("message", (data) => resolve(String(data))));
    await new Promise((resolve) => socket.once("open", resolve));
    socket.send(serialize(hello));
    expect(JSON.parse(await first)).toMatchObject({ id: 0, type: "welcome", payload: { lastReceivedId: 0 } });
    await expect.poll(async () => (await getMachineOfMember(db, ann.id))?.connected).toBe(true);
    expect(await getMachineOfMember(db, ann.id)).toMatchObject({ hostname: "ann-laptop", os: "linux" });
    socket.close();

    // ADR 0007: the installer and the doctor ask whether the token is still paired.
    const check = await fetch(`${http}/agent/check`, { headers: { authorization: `Bearer ${token}` } });
    expect(check.status).toBe(200);
    expect(await check.json()).toEqual({ paired: true, webUrl: "https://app.test" });
    expect(check.headers.get("date")).toBeTruthy();
  });

  it("ADR 0007: the token check refuses an unknown or missing token", async () => {
    expect((await fetch(`${http}/agent/check`, { headers: { authorization: "Bearer nope" } })).status).toBe(401);
    expect((await fetch(`${http}/agent/check`)).status).toBe(401);
  });

  it("refuses a malformed pairing request and a token already in use", async () => {
    expect((await pair({ tokenHash: "short", hostname: "x", os: "linux", arch: "x64" })).status).toBe(400);
    const tokenHash = "a".repeat(64);
    expect((await pair({ tokenHash, hostname: "x", os: "linux", arch: "x64" })).status).toBe(201);
    expect((await pair({ tokenHash, hostname: "x", os: "linux", arch: "x64" })).status).toBe(409);
  });

  it("asks for a token on the status check", async () => {
    const res = await fetch(`${http}/pair/00000000-0000-0000-0000-000000000000`);
    expect(res.status).toBe(401);
  });

  it("T0-13: an unknown token is closed with 4401", async () => {
    const socket = new WebSocket(`${ws}/agent`, { headers: { authorization: "Bearer nope" } });
    const code = await new Promise<number>((resolve) => socket.once("close", resolve));
    expect(code).toBe(CloseCode.Unauthorized);
  });

  it("a browser socket without a ticket is closed with 4401", async () => {
    const socket = new WebSocket(`${ws}/browser`);
    const code = await new Promise<number>((resolve) => socket.once("close", resolve));
    expect(code).toBe(CloseCode.Unauthorized);
  });

  it("answers the health check", async () => {
    const res = await fetch(`${http}/health`);
    expect(await res.json()).toEqual({ ok: true });
  });
});
