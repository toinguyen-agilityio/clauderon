import { describe, expect, it } from "vitest";
import { DEFAULT_LIMIT_CEILING, checkLimits, parseLimitCeiling, queuePositions, schedule } from "../src/index";

describe("parseLimitCeiling (POD-2)", () => {
  it("reads the three keys", () => {
    expect(parseLimitCeiling("slots=6,cpus=8,memoryMb=16384")).toEqual({ slots: 6, cpus: 8, memoryMb: 16384 });
  });
  it("keeps the default for a missing or bad key", () => {
    expect(parseLimitCeiling(undefined)).toEqual(DEFAULT_LIMIT_CEILING);
    expect(parseLimitCeiling("slots=abc,cpus=2")).toEqual({ ...DEFAULT_LIMIT_CEILING, cpus: 2 });
  });
});

describe("checkLimits (POD-2)", () => {
  const ceiling = { slots: 4, cpus: 4, memoryMb: 8192 };
  it("T2-9: refuses Slots, CPU or RAM above the ceiling", () => {
    expect(checkLimits({ slots: 5, cpus: 2, memoryMb: 4096 }, ceiling)).toEqual({ ok: false, error: "Slots are capped at 4." });
    expect(checkLimits({ slots: 2, cpus: 5, memoryMb: 4096 }, ceiling)).toMatchObject({ ok: false });
    expect(checkLimits({ slots: 2, cpus: 2, memoryMb: 9000 }, ceiling)).toMatchObject({ ok: false });
  });
  it("accepts values at the ceiling and reads numbers from form strings", () => {
    expect(checkLimits({ slots: "4", cpus: "4", memoryMb: "8192" }, ceiling)).toEqual({ ok: true, limits: { slots: 4, cpus: 4, memoryMb: 8192 } });
  });
  it("refuses zero, fractions of a Slot and junk", () => {
    expect(checkLimits({ slots: 0, cpus: 2, memoryMb: 4096 }, ceiling)).toMatchObject({ ok: false });
    expect(checkLimits({ slots: 1.5, cpus: 2, memoryMb: 4096 }, ceiling)).toMatchObject({ ok: false });
    expect(checkLimits({ slots: 2, cpus: "x", memoryMb: 4096 }, ceiling)).toMatchObject({ ok: false });
  });
});

describe("queuePositions (spec M2 §6)", () => {
  it("starts at once while Slots are free, then queues first in, first out", () => {
    expect(queuePositions({ slots: 2, inUse: 0, queued: 0 }, 4)).toEqual([0, 0, 1, 2]);
  });
  it("queues behind busy Slots and the Runs already waiting", () => {
    expect(queuePositions({ slots: 2, inUse: 2, queued: 0 }, 2)).toEqual([1, 2]);
    expect(queuePositions({ slots: 2, inUse: 2, queued: 3 }, 1)).toEqual([4]);
  });
});

describe("lowering Slots (POD-6)", () => {
  it("T2-8: with 2 running and Slots lowered to 1, nothing new starts until both end", () => {
    const run = (id: string, state: "running" | "queued", at: number) => ({ id, state, queuedAt: new Date(at) });
    const runs = [run("a", "running", 1), run("b", "running", 2), run("c", "queued", 3)];
    expect(schedule({ status: "running", slots: 1 }, runs)).toEqual([]);
    expect(schedule({ status: "running", slots: 1 }, [run("b", "running", 2), run("c", "queued", 3)])).toEqual([]);
    expect(schedule({ status: "running", slots: 1 }, [run("c", "queued", 3)])).toEqual(["c"]);
  });
});
