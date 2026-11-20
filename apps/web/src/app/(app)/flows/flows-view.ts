import type { NodeKind } from "@clauderon/core";

// What the Flows page shows and decides, apart from React: one row per Flow,
// the search and scope filters, and the short preview of a Flow's Nodes. Pure,
// so it is unit-tested.

/** One Flow as the list needs it (serialisable: it crosses from the server page to the client list). */
export type FlowRowView = {
  id: string;
  name: string;
  isSample: boolean;
  nodeCount: number;
  problems: number;
  nodes: { name: string; kind: NodeKind }[];
  /** Null for a sample nobody has changed since the seed. */
  updatedBy: string | null;
  /** "5 h ago", worked out on the server. */
  updatedLabel: string;
  /** The exact time, for a tooltip. */
  updatedTitle: string;
  lock: { runId: string; state: string } | null;
};

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

/** The first Nodes of a Flow to draw in a row, and how many were left out. */
export function pipelinePreview<T>(nodes: readonly T[], max = 6): { shown: T[]; hidden: T[] } {
  return { shown: nodes.slice(0, max), hidden: nodes.slice(max) };
}

export const problemsLabel = (n: number) => `${n} problem${n === 1 ? "" : "s"}`;
