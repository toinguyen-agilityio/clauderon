import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { fileStateStore, readHostFacts } from "../src/runtime.js";

let dir: string | null = null;
afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = null;
});

describe("fileStateStore", () => {
  it("starts at 0 and keeps the last received id across restarts", async () => {
    dir = await mkdtemp(join(tmpdir(), "host-agent-"));
    const store = fileStateStore(join(dir, "nested"));
    expect(await store.load()).toEqual({ lastReceivedId: 0 });
    await store.save({ lastReceivedId: 42 });
    expect(await fileStateStore(join(dir, "nested")).load()).toEqual({ lastReceivedId: 42 });
  });
});

describe("readHostFacts", () => {
  it("reports architecture, CPU, RAM, disk and whether Docker answers", async () => {
    const facts = await readHostFacts(join(tmpdir(), "does-not-exist-yet"));
    expect(facts.cpus).toBeGreaterThan(0);
    expect(facts.memoryMb).toBeGreaterThan(0);
    expect(facts.diskGb).toBeGreaterThan(0);
    expect(typeof facts.dockerRunning).toBe("boolean");
  });
});
