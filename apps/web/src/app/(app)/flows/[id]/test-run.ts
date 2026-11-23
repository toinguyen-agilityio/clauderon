// The editor's Test run: a walk through the Flow in the order the Run engine would
// take (core's topologicalOrder), shown on the canvas. It runs nothing: no Machine, no
// GitHub, no Claude. A real Run is started from Tickets.

import { topologicalOrder, type Flow, type NodeKind } from "@clauderon/core";

export type PreviewNodeState = "queued" | "running" | "waiting" | "succeeded";
export type PreviewEdgeState = "active" | "done";

/** Where a Test run is: the Node order, which step is current and whether it waits for a person. */
export type TestRun = { order: string[]; index: number; phase: "running" | "waiting" | "done" };

/** Approve and Grill Nodes stop for a person in a real Run; the Test run shows that pause. */
export const waitsForPerson = (kind: NodeKind) => kind === "approve" || kind === "grill";

/** A new Test run, or the reason one cannot start (a Flow with a cycle has no order). */
export function startTestRun(flow: Flow): TestRun | { error: string } {
  if (flow.nodes.length === 0) return { error: "Add a Node first." };
  try {
    return { order: topologicalOrder(flow), index: 0, phase: "running" };
  } catch {
    return { error: "The Flow has a cycle, so it has no order to run in." };
  }
}

/** The next state after the current step finishes (or, for a Node that waits, after its pause). */
export function advanceTestRun(run: TestRun, kindOf: (flowNodeId: string) => NodeKind | undefined): TestRun {
  if (run.phase === "done") return run;
  const current = run.order[run.index];
  if (run.phase === "running" && current && waitsForPerson(kindOf(current) ?? "agent")) return { ...run, phase: "waiting" };
  const index = run.index + 1;
  return index >= run.order.length ? { ...run, index: run.order.length, phase: "done" } : { ...run, index, phase: "running" };
}

/** How each Node looks during a Test run: done before the current step, queued after it. */
export function nodeStates(run: TestRun): Map<string, PreviewNodeState> {
  return new Map(
    run.order.map((id, i): [string, PreviewNodeState] => [
      id,
      i < run.index || run.phase === "done" ? "succeeded" : i === run.index ? (run.phase === "waiting" ? "waiting" : "running") : "queued",
    ]),
  );
}

/** Edges between finished Nodes are done; an edge from a finished Node into the current one is carrying data. */
export function edgeStates(run: TestRun, edges: Flow["edges"]): Map<string, PreviewEdgeState> {
  const nodes = nodeStates(run);
  const out = new Map<string, PreviewEdgeState>();
  for (const e of edges) {
    if (nodes.get(e.fromFlowNodeId) !== "succeeded") continue;
    const to = nodes.get(e.toFlowNodeId);
    if (to === "succeeded") out.set(e.id, "done");
    else if (to === "running" || to === "waiting") out.set(e.id, "active");
  }
  return out;
}
