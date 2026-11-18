import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { LibraryNode } from "@clauderon/core";
import type { EditorData } from "../../../../server/flows";

// Builds the React Flow nodes and edges from the editor's state, reusing the
// previous object whenever nothing structural changed. React Flow treats a new node
// object as a changed Node: it re-measures its handles, which removes and re-creates
// every edge attached to it (a visible flicker on each keystroke in the Node panel).
// Only structure goes in here (position, library Node, selection, edge ends and
// error); anything a Node merely displays (label, instructions, enabled Outputs)
// reaches NodeView through PlacementsContext instead.

export type Placement = EditorData["graph"]["nodes"][number];
export type GraphEdge = EditorData["graph"]["edges"][number];
export type FlowNode = Node<{ lib: LibraryNode }, "clauderon">;
export type FlowEdge = Edge<{ reason: string | null }>;

/** One shared object: a fresh `markerEnd` per build would make every edge look changed. */
const MARKER_END = { type: MarkerType.ArrowClosed } as const;

export function buildNodes(
  placements: readonly Placement[],
  libById: ReadonlyMap<string, LibraryNode>,
  selectedIds: ReadonlySet<string>,
  prev: ReadonlyMap<string, FlowNode>,
): Map<string, FlowNode> {
  const next = new Map<string, FlowNode>();
  for (const p of placements) {
    const lib = libById.get(p.nodeId);
    if (!lib) continue;
    const selected = selectedIds.has(p.id);
    const old = prev.get(p.id);
    next.set(
      p.id,
      old && old.position.x === p.x && old.position.y === p.y && old.data.lib === lib && old.selected === selected
        ? old
        : { id: p.id, type: "clauderon", position: { x: p.x, y: p.y }, selected, data: { lib } },
    );
  }
  return next;
}

export function buildEdges(
  graphEdges: readonly GraphEdge[],
  edgeProblem: ReadonlyMap<string, string>,
  selectedIds: ReadonlySet<string>,
  prev: ReadonlyMap<string, FlowEdge>,
): Map<string, FlowEdge> {
  const next = new Map<string, FlowEdge>();
  for (const e of graphEdges) {
    const reason = edgeProblem.get(e.id) ?? null;
    const selected = selectedIds.has(e.id);
    const old = prev.get(e.id);
    next.set(
      e.id,
      old &&
        old.source === e.fromFlowNodeId &&
        old.sourceHandle === e.fromOutput &&
        old.target === e.toFlowNodeId &&
        old.targetHandle === e.toInput &&
        old.selected === selected &&
        old.data?.reason === reason
        ? old
        : {
            id: e.id,
            type: "clauderon",
            source: e.fromFlowNodeId,
            sourceHandle: e.fromOutput,
            target: e.toFlowNodeId,
            targetHandle: e.toInput,
            selected,
            markerEnd: MARKER_END,
            data: { reason },
          },
    );
  }
  return next;
}
