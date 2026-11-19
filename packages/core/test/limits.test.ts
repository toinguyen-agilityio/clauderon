import { describe, expect, it } from "vitest";
import { MAX_SLOTS, checkSlots, queuePositions, schedule } from "../src/index";

describe("checkSlots (ADR 0006)", () => {
  it("accepts 1 to MAX_SLOTS and reads numbers from form strings", () => {
    expect(checkSlots("4")).toEqual({ ok: true, slots: 4 });
    expect(checkSlots(MAX_SLOTS)).toEqual({ ok: true, slots: MAX_SLOTS });
  });
  it("refuses zero, fractions, junk and more than MAX_SLOTS", () => {
    expect(checkSlots(0)).toMatchObject({ ok: false });
    expect(checkSlots(1.5)).toMatchObject({ ok: false });
    expect(checkSlots("x")).toMatchObject({ ok: false });
    expect(checkSlots(MAX_SLOTS + 1)).toEqual({ ok: false, error: `Slots are capped at ${MAX_SLOTS}.` });
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
    expect(schedule({ connected: true, slots: 1 }, runs)).toEqual([]);
    expect(schedule({ connected: true, slots: 1 }, [run("b", "running", 2), run("c", "queued", 3)])).toEqual([]);
    expect(schedule({ connected: true, slots: 1 }, [run("c", "queued", 3)])).toEqual(["c"]);
  });
});
