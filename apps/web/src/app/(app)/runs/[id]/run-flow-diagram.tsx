"use client";

import { useMemo } from "react";
import type { FlowSnapshot } from "@clauderon/core";
import { duration } from "../../../../components/format";
import { outputColor } from "../../../../components/state-pill";
import type { viewRun } from "../../../../server/runs";
import { FlowCanvas, type CanvasEdge, type CanvasNode } from "../../flows/[id]/flow-canvas";
import { NodeView } from "../../flows/[id]/flow-node";
import { diagramEdgeStates, diagramPositions, diagramState, type DiagramState } from "./run-diagram";

type Timeline = Exclude<Awaited<ReturnType<typeof viewRun>>, "not-found">["timeline"];

/**
 * The Run's Flow as it was at Start (#189): the Flow editor's canvas, read only and laid out left to
 * right, each Node in the state its Attempts put it in. Choosing a Node shows it in the panel below.
 */
export function RunDiagram({ snapshot, timeline, selectedId, onSelect }: { snapshot: FlowSnapshot; timeline: Timeline; selectedId: string | undefined; onSelect: (nodeId: string) => void }) {
  const byId = useMemo(() => new Map(timeline.map((n) => [n.id, n])), [timeline]);
  const states = useMemo(() => new Map(timeline.map((n): [string, DiagramState] => [n.id, diagramState(n.state)])), [timeline]);
  const positions = useMemo(() => diagramPositions(snapshot.nodes, snapshot.edges), [snapshot]);
  const edgeStates = useMemo(() => diagramEdgeStates(snapshot.edges, states), [snapshot, states]);

  const nodes: CanvasNode[] = snapshot.nodes.map((n) => {
    const at = positions.get(n.id) ?? { x: 0, y: 0 };
    const row = byId.get(n.id);
    const attempts = row?.attempts.length ?? 0;
    const caption = [row?.durationMs != null ? duration(row.durationMs) : null, attempts > 1 ? `${attempts} Attempts` : null].filter(Boolean).join(" · ");
    return {
      id: n.id,
      x: at.x,
      y: at.y,
      selected: n.id === selectedId,
      content: (
        <NodeView
          id={n.id}
          lib={{ id: n.id, name: n.name, kind: n.kind, inputs: n.inputs, outputs: n.outputs }}
          placement={{ id: n.id, nodeId: n.nodeId, label: null, extraInstructions: n.extraInstructions, enabledOptionalOutputs: n.enabledOptionalOutputs, x: at.x, y: at.y }}
          selected={n.id === selectedId}
          focused={false}
          readOnly
          problems={[]}
          runState={states.get(n.id)}
          caption={caption || undefined}
          wire={null}
          renaming={false}
          onRename={() => {}}
          onAction={() => {}}
          onAdd={() => {}}
        />
      ),
    };
  });

  const typeOf = (nodeId: string, output: string) => snapshot.nodes.find((n) => n.id === nodeId)?.outputs.find((o) => o.name === output)?.type ?? "";
  const edges: CanvasEdge[] = snapshot.edges.map((e) => ({
    id: e.id,
    fromNodeId: e.fromFlowNodeId,
    fromOutput: e.fromOutput,
    toNodeId: e.toFlowNodeId,
    toInput: e.toInput,
    selected: false,
    reason: null,
    color: outputColor(typeOf(e.fromFlowNodeId, e.fromOutput)),
    state: edgeStates.get(e.id) ?? null,
  }));

  return (
    <div className="run-diagram" role="group" aria-label="Flow of this Run">
      <FlowCanvas
        nodes={nodes}
        edges={edges}
        readOnly
        fixed
        onSelect={(next) => {
          const [first] = next.nodes;
          if (first) onSelect(first);
        }}
        onMoveNodes={() => {}}
        onConnect={() => {}}
        onDelete={() => {}}
        canConnect={() => false}
      />
    </div>
  );
}
