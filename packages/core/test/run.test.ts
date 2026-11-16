import { describe, expect, it } from "vitest";
import {
  RUN_EVENTS,
  RUN_STATES,
  holdsSlot,
  isActive,
  nextNode,
  schedule,
  transition,
  type AttemptView,
  type RunEvent,
  type RunState,
} from "../src/index.js";
import { basicDelivery, library, planAndDeliver } from "./fixtures.js";

// The lifecycle diagram of requirements §4.5, written out by hand.
const allowed: Record<RunState, Partial<Record<RunEvent, RunState>>> = {
  queued: { slot_free: "running", cancel: "cancelled" },
  running: {
    reach_human: "waiting_for_human",
    last_node_done: "succeeded",
    node_failed: "failed",
    interrupt: "interrupted",
    cancel: "cancelled",
  },
  waiting_for_human: { human_responded: "running", reject: "failed", cancel: "cancelled" },
  failed: { retry: "queued", cancel: "cancelled" },
  interrupted: { retry: "queued", cancel: "cancelled" },
  succeeded: {},
  cancelled: {},
};

describe("transition", () => {
  it("T0-5: allows every move in the lifecycle diagram and refuses every other one", () => {
    for (const state of RUN_STATES) {
      for (const event of RUN_EVENTS) {
        const result = transition({ id: "r1", state }, event);
        const expected = allowed[state][event];
        if (expected) expect(result).toEqual({ ok: true, run: { id: "r1", state: expected } });
        else expect(result).toEqual({ ok: false, error: `Cannot ${event} a ${state} Run` });
      }
    }
  });
});

describe("holdsSlot and isActive", () => {
  it("only Running and Waiting for human hold a Slot", () => {
    expect(RUN_STATES.filter(holdsSlot)).toEqual(["running", "waiting_for_human"]);
  });

  it("everything but Succeeded and Cancelled is Active", () => {
    expect(RUN_STATES.filter((s) => !isActive(s))).toEqual(["succeeded", "cancelled"]);
  });
});

const ok = (flowNodeId: string, outputs: string[]): AttemptView => ({ flowNodeId, state: "succeeded", outputs });

describe("nextNode", () => {
  it("walks the Nodes in topological order", () => {
    const run = { flow: basicDelivery, library };
    expect(nextNode(run, [])).toBe("t");
    expect(nextNode(run, [ok("t", ["issue"])])).toBe("code");
    expect(nextNode(run, [ok("t", ["issue"]), ok("code", ["branch"])])).toBe("test");
  });

  it("does not count failed Attempts as done", () => {
    const run = { flow: basicDelivery, library };
    expect(nextNode(run, [ok("t", ["issue"]), { flowNodeId: "code", state: "failed", outputs: [] }])).toBe("code");
  });

  it("T0-6: skips a Node whose required input is an unproduced optional Output, and the Run can still end", () => {
    const run = { flow: planAndDeliver, library };
    const attempts = [
      ok("t", ["issue"]),
      ok("grill", ["plan"]),
      ok("approve", ["plan"]),
      ok("code", ["branch", "summary"]),
      ok("test", ["test-result"]),
      ok("shots", ["screenshot"]),
      ok("pr", []), // no changes: no pull-request Output (RUN-11)
    ];
    expect(nextNode(run, attempts)).toBe("done");
  });
});

describe("schedule", () => {
  const pod = { status: "running" as const, slots: 2 };
  const run = (id: string, state: RunState, queuedAt: number) => ({ id, state, queuedAt: new Date(queuedAt) });

  it("T0-7: with 2 Slots, 1 running and 1 waiting, starts nothing", () => {
    const runs = [run("a", "running", 1), run("b", "waiting_for_human", 2), run("c", "queued", 3)];
    expect(schedule(pod, runs)).toEqual([]);
  });

  it("T0-7: after one ends, starts the oldest Queued Run", () => {
    const runs = [run("a", "succeeded", 1), run("b", "waiting_for_human", 2), run("d", "queued", 5), run("c", "queued", 3)];
    expect(schedule(pod, runs)).toEqual(["c"]);
  });

  it("breaks ties on queued time by id and fills every free Slot", () => {
    const runs = [run("z", "queued", 1), run("y", "queued", 1), run("x", "queued", 2)];
    expect(schedule({ status: "running", slots: 2 }, runs)).toEqual(["y", "z"]);
  });

  it("starts nothing on a Pod that is not running (POD-5)", () => {
    expect(schedule({ status: "stopped", slots: 2 }, [run("a", "queued", 1)])).toEqual([]);
  });

  it("Failed and Interrupted Runs do not hold a Slot (RUN-9)", () => {
    const runs = [run("a", "failed", 1), run("b", "interrupted", 2), run("c", "queued", 3)];
    expect(schedule({ status: "running", slots: 1 }, runs)).toEqual(["c"]);
  });
});
