import type { Flow, FlowEdge, LibraryNode, NodeInput, NodeKind, NodeOutput } from "./flow";
import type { ClaudeModel } from "./library";

/** One placement as it was when the Run started, with its library Node inlined. */
export type SnapshotNode = {
  id: string;
  nodeId: string;
  name: string;
  kind: NodeKind;
  instructions: string;
  command: string | null;
  inputs: NodeInput[];
  outputs: NodeOutput[];
  extraInstructions: string;
  enabledOptionalOutputs: string[];
  /** The library Node's model and turn limit (#218); absent in snapshots from before them. */
  model?: ClaudeModel | null;
  maxTurns?: number | null;
  x: number;
  y: number;
};

/**
 * `run.flow_snapshot`: the Flow's Nodes and edges at Start, so a Run keeps
 * running, and past Runs still render, after the Flow or library changes.
 */
export type FlowSnapshot = { name: string; nodes: SnapshotNode[]; edges: FlowEdge[] };

/** The Flow and library a snapshot stands for, for `nextNode` and `topologicalOrder`. */
export function snapshotFlow(snapshot: FlowSnapshot): { flow: Flow; library: LibraryNode[] } {
  return {
    flow: {
      nodes: snapshot.nodes.map((n) => ({ id: n.id, nodeId: n.id, x: n.x, y: n.y, enabledOptionalOutputs: n.enabledOptionalOutputs })),
      edges: snapshot.edges,
    },
    // Keyed by placement id: two placements of one Node may differ in the future.
    library: snapshot.nodes.map((n) => ({ id: n.id, name: n.name, kind: n.kind, inputs: n.inputs, outputs: n.outputs })),
  };
}
