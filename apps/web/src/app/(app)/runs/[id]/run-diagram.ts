// The Run page's Flow diagram (#189): the Flow as it was when the Run started, laid out left to
// right, with each Node in the state its Attempts put it in. Pure, so it is unit-tested.

import { isEntryKind, type FlowEdge, type SnapshotNode } from "@clauderon/core";
import type { NodeState } from "../../../../server/runs";
import { layeredLayout } from "../../flows/[id]/flow-layout";

/** How a Node looks in the diagram: the Run's Node states, with "waiting for a person" as the canvas calls it. */
export type DiagramState = "queued" | "running" | "waiting" | "succeeded" | "failed" | "interrupted" | "cancelled" | "not reached";
export type DiagramEdgeState = "active" | "done" | null;

export const diagramState = (state: NodeState): DiagramState => (state === "waiting_for_human" ? "waiting" : state);

const PILL = { w: 150, h: 44 };
const CARD_W = 208;
const ROW_H = 20;
const CARD_BASE_H = 78;

/** The size the canvas will draw a Node at, close enough to lay it out before it has been measured. */
export function nodeSize(node: Pick<SnapshotNode, "kind" | "inputs" | "outputs">): { w: number; h: number } {
  if (isEntryKind(node.kind)) return PILL;
  return { w: CARD_W, h: CARD_BASE_H + Math.max(node.inputs.length, node.outputs.length) * ROW_H };
}

/**
 * Left-to-right positions: one column for each step of the longest path to a Node, Nodes of the same
 * step stacked in that column. The saved canvas positions are not used, so a Flow drawn top to bottom
 * still reads from left to right.
 */
export function diagramPositions(nodes: readonly SnapshotNode[], edges: readonly FlowEdge[]): Map<string, { x: number; y: number }> {
  return layeredLayout(
    nodes.map((n) => ({ id: n.id, x: 0, y: nodes.indexOf(n), ...nodeSize(n) })),
    edges.map((e) => ({ from: e.fromFlowNodeId, to: e.toFlowNodeId })),
  );
}

/** An edge is carrying data into the Node that is running or waiting, and done once both ends are. */
export function diagramEdgeStates(edges: readonly FlowEdge[], states: ReadonlyMap<string, DiagramState>): Map<string, DiagramEdgeState> {
  const out = new Map<string, DiagramEdgeState>();
  for (const e of edges) {
    if (states.get(e.fromFlowNodeId) !== "succeeded") continue;
    const to = states.get(e.toFlowNodeId);
    if (to === "succeeded") out.set(e.id, "done");
    else if (to === "running" || to === "waiting") out.set(e.id, "active");
  }
  return out;
}

/** Which Node the diagram selects first: the one running or waiting, else the one that failed, else the last that ran. */
export function currentNodeId(nodes: readonly { id: string; state: NodeState; attempts: readonly unknown[] }[]): string | undefined {
  return (
    nodes.find((n) => n.state === "running")?.id ??
    nodes.find((n) => n.state === "waiting_for_human")?.id ??
    nodes.find((n) => n.state === "failed" || n.state === "interrupted")?.id ??
    [...nodes].reverse().find((n) => n.attempts.length > 0)?.id ??
    nodes[0]?.id
  );
}
