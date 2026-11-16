import { topologicalOrder, type Flow, type LibraryNode } from "./flow";

export const RUN_STATES = ["queued", "running", "waiting_for_human", "succeeded", "failed", "interrupted", "cancelled"] as const;
export type RunState = (typeof RUN_STATES)[number];

export const RUN_EVENTS = [
  "slot_free",
  "reach_human",
  "human_responded",
  "reject",
  "last_node_done",
  "node_failed",
  "interrupt",
  "retry",
  "cancel",
] as const;
export type RunEvent = (typeof RUN_EVENTS)[number];

/** The Run lifecycle of requirements §4.5; anything not listed is refused. */
const MOVES: Record<RunState, Partial<Record<RunEvent, RunState>>> = {
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

export type TransitionResult<T> = { ok: true; run: T } | { ok: false; error: string };

export function transition<T extends { state: RunState }>(run: T, event: RunEvent): TransitionResult<T> {
  const next = MOVES[run.state][event];
  if (!next) return { ok: false, error: `Cannot ${event} a ${run.state} Run` };
  return { ok: true, run: { ...run, state: next } };
}

/** A Run holds a Slot only while Running or Waiting for human (RUN-9). */
export function holdsSlot(state: RunState): boolean {
  return state === "running" || state === "waiting_for_human";
}

export function isActive(state: RunState): boolean {
  return state !== "succeeded" && state !== "cancelled";
}

export type AttemptState = "running" | "waiting_for_human" | "succeeded" | "failed" | "interrupted" | "cancelled";

/** What `nextNode` needs to know about an Attempt: which Outputs it produced. */
export type AttemptView = { flowNodeId: string; state: AttemptState; outputs: string[] };

/**
 * The next Node to run (RUN-2, RUN-16): the first Node in topological order
 * without a succeeded Attempt whose required inputs all exist. A Node whose
 * required input was never produced (an optional Output left out upstream) is
 * not reached and is skipped. `attempts` are the Attempts of the current pass:
 * the caller leaves out those a Retry superseded.
 */
export function nextNode(run: { flow: Flow; library: readonly LibraryNode[] }, attempts: readonly AttemptView[]): string | "done" {
  const byId = new Map(run.library.map((n) => [n.id, n]));
  const placements = new Map(run.flow.nodes.map((n) => [n.id, n]));
  const produced = new Set<string>();
  const succeeded = new Map<string, AttemptView>();
  for (const a of attempts) if (a.state === "succeeded") succeeded.set(a.flowNodeId, a);

  for (const id of topologicalOrder(run.flow)) {
    const done = succeeded.get(id);
    if (done) {
      for (const output of done.outputs) produced.add(`${id}.${output}`);
      continue;
    }
    const lib = byId.get(placements.get(id)?.nodeId ?? "");
    const reached = (lib?.inputs ?? [])
      .filter((input) => input.required)
      .every((input) => {
        const e = run.flow.edges.find((edge) => edge.toFlowNodeId === id && edge.toInput === input.name);
        return e !== undefined && produced.has(`${e.fromFlowNodeId}.${e.fromOutput}`);
      });
    if (reached) return id;
  }
  return "done";
}

export type PodForSchedule = { status: string; slots: number };
export type RunForSchedule = { id: string; state: RunState; queuedAt: Date };

/** Queued Runs to start now on a Pod (POD-3): oldest first, while Slots are free. */
export function schedule(pod: PodForSchedule, runs: readonly RunForSchedule[]): string[] {
  if (pod.status !== "running") return [];
  const free = pod.slots - runs.filter((r) => holdsSlot(r.state)).length;
  if (free <= 0) return [];
  return runs
    .filter((r) => r.state === "queued")
    .sort((a, b) => a.queuedAt.getTime() - b.queuedAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, free)
    .map((r) => r.id);
}
