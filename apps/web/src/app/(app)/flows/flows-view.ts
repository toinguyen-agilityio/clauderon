import { INPUT_TYPES, type NodeKind, type OutputType } from "@clauderon/core";

// What the Flows page shows and decides, apart from React: one row per Flow,
// the search and scope filters, and the short preview of a Flow's Nodes. Pure,
// so it is unit-tested.

/** One Flow as the list needs it (serialisable: it crosses from the server page to the client list). */
export type FlowRowView = {
  id: string;
  name: string;
  isSample: boolean;
  nodeCount: number;
  /** Runs in the Flow's history; they stay there when the Flow is deleted. */
  runCount: number;
  problems: number;
  /** In run order; `step` groups the Nodes that can run side by side. */
  nodes: { name: string; kind: NodeKind; step: number }[];
  /** What the Flow starts from; an `issue` Flow starts from the Tickets page. */
  inputType: OutputType | null;
  /** The Member's name, or their email when they have none. Null for a sample nobody has changed since the seed. */
  updatedBy: string | null;
  /** "5 h ago", worked out on the server. */
  updatedLabel: string;
  /** The exact time, for a tooltip. */
  updatedTitle: string;
  lock: { runId: string; state: string } | null;
};

/** What the Delete dialog says about the Flow's Runs, or null when it has none. */
export function deleteRunsNote(runCount: number): string | null {
  if (runCount <= 0) return null;
  return `Its ${runCount} Run${runCount === 1 ? "" : "s"} stay${runCount === 1 ? "s" : ""} in the Runs history.`;
}

export type FlowScope = "all" | "mine" | "samples" | "problems";

/** Flows whose name or whose Nodes' names contain the query, within the chosen scope. */
export function filterFlows(flows: readonly FlowRowView[], query: string, scope: FlowScope): FlowRowView[] {
  const q = query.trim().toLowerCase();
  return flows.filter((f) => {
    if (scope === "mine" && f.isSample) return false;
    if (scope === "samples" && !f.isSample) return false;
    if (scope === "problems" && f.problems === 0) return false;
    return !q || f.name.toLowerCase().includes(q) || f.nodes.some((n) => n.name.toLowerCase().includes(q));
  });
}

/** How many Flows each scope holds, for the filter chips. */
export function scopeCounts(flows: readonly FlowRowView[]): Record<FlowScope, number> {
  return {
    all: flows.length,
    mine: flows.filter((f) => !f.isSample).length,
    samples: flows.filter((f) => f.isSample).length,
    problems: flows.filter((f) => f.problems > 0).length,
  };
}

/** The samples (pinned on top) apart from the Flows a Member cloned or made, each keeping its order. */
export function groupFlows<T extends Pick<FlowRowView, "isSample">>(flows: readonly T[]): { samples: T[]; mine: T[] } {
  return { samples: flows.filter((f) => f.isSample), mine: flows.filter((f) => !f.isSample) };
}

/** A Flow's Nodes grouped by step, in step order: each group can run side by side. */
export function flowSteps<T extends { step: number }>(nodes: readonly T[]): T[][] {
  const steps: T[][] = [];
  for (const n of nodes) (steps[n.step] ??= []).push(n);
  return steps.filter((s) => s !== undefined);
}

export const problemsLabel = (n: number) => `${n} problem${n === 1 ? "" : "s"}`;

/**
 * How a Flow without problems is started from the Flows list and the editor: the Start Run
 * dialog for its Input, or the Tickets page for a Ticket Input. Null while it has problems.
 */
export function flowStart(inputType: OutputType | null | undefined, problems: number): "dialog" | "tickets" | null {
  if (problems > 0 || !inputType || !(INPUT_TYPES as readonly string[]).includes(inputType)) return null;
  return inputType === "issue" ? "tickets" : "dialog";
}
