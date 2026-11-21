import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { acquireLock, cpuBusyPercent, fileStateStore, machineUsageReader, pairingFile, parseVmStat, readMachineFacts } from "../src/runtime";

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

describe("machine usage", () => {
  it("counts app, wired and compressed pages from vm_stat as used memory", () => {
    const text = [
      "Mach Virtual Memory Statistics: (page size of 16384 bytes)",
      "Pages free:                                5422.",
      "Pages wired down:                        100.",
      "Pages purgeable:                           50.",
      "Anonymous pages:                         1000.",
      "Pages occupied by compressor:            200.",
    ].join("\n");
    expect(parseVmStat(text)).toBe((1000 - 50 + 100 + 200) * 16384);
    expect(parseVmStat("nothing here")).toBeNull();
  });

  it("gives the busy share of CPU time between two readings", () => {
    expect(cpuBusyPercent({ busy: 100, total: 1000 }, { busy: 230, total: 2000 })).toBe(13);
    expect(cpuBusyPercent({ busy: 5, total: 10 }, { busy: 5, total: 10 })).toBe(0);
  });

  it("reads memory, free disk and CPU on this computer", async () => {
    const usage = await machineUsageReader(tmpdir())();
    expect(usage?.memoryUsedMb).toBeGreaterThan(0);
    expect(usage?.diskFreeGb).toBeGreaterThanOrEqual(0);
    expect(usage?.cpuPercent).toBeGreaterThanOrEqual(0);
    expect(usage?.cpuPercent).toBeLessThanOrEqual(100);
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
