import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { acquireLock, fileStateStore, pairingFile, readMachineFacts } from "../src/runtime";

let dir: string | null = null;
afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = null;
});

describe("fileStateStore", () => {
  it("starts at 0 and keeps the last received id across restarts", async () => {
    dir = await mkdtemp(join(tmpdir(), "agent-"));
    const store = fileStateStore(join(dir, "nested"));
    expect(await store.load()).toEqual({ lastReceivedId: 0 });
    await store.save({ lastReceivedId: 42 });
    expect(await fileStateStore(join(dir, "nested")).load()).toEqual({ lastReceivedId: 42 });
  });
});

describe("readMachineFacts", () => {
  it("reports the operating system, hostname, architecture, CPU, RAM and disk", async () => {
    const facts = await readMachineFacts(join(tmpdir(), "does-not-exist-yet"));
    expect(facts.os).toBe(process.platform);
    expect(facts.hostname.length).toBeGreaterThan(0);
    expect(facts.cpus).toBeGreaterThan(0);
    expect(facts.memoryMb).toBeGreaterThan(0);
    expect(facts.diskGb).toBeGreaterThan(0);
  });
});

describe("pairingFile", () => {
  it("keeps the Gateway and token readable by the Member only", async () => {
    dir = await mkdtemp(join(tmpdir(), "agent-"));
    const file = pairingFile(join(dir, "home"));
    expect(await file.load()).toBeNull();
    await file.save({ gatewayUrl: "wss://gateway.test", token: "t0k3n" });
    expect(await pairingFile(join(dir, "home")).load()).toEqual({ gatewayUrl: "wss://gateway.test", token: "t0k3n" });
    if (process.platform !== "win32") expect((await stat(join(dir, "home", "agent.json"))).mode & 0o777).toBe(0o600);
  });
});

describe("acquireLock", () => {
  it("lets one Agent run per home; a dead holder's lock is taken over", async () => {
    dir = await mkdtemp(join(tmpdir(), "agent-"));
    const first = await acquireLock(dir);
    expect(first.ok).toBe(true);
    // This test process is alive, so another Agent on the same home is refused.
    expect(await acquireLock(dir, process.pid + 1_000_000)).toEqual({ ok: false, pid: process.pid });
    if (first.ok) await first.release();
    expect((await acquireLock(dir, process.pid + 1_000_000)).ok).toBe(true);
  });
});
