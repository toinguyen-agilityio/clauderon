import type { FlowFile, LibraryNode } from "@clauderon/core";
import { layeredLayout } from "./[id]/flow-layout";

// What the Build with Agent preview shows of a Flow Draft (ADR 0008), apart from React: the
// Gateway's checked Flow file turned into what the canvas draws, laid out left to right. Pure,
// so it is unit-tested.

export type DraftPlacement = { id: string; nodeId: string; label: string | null; extraInstructions: string; enabledOptionalOutputs: string[]; x: number; y: number };
export type DraftEdge = { id: string; fromFlowNodeId: string; fromOutput: string; toFlowNodeId: string; toInput: string };
export type DraftView = { name: string; library: Map<string, LibraryNode>; placements: DraftPlacement[]; edges: DraftEdge[] };

/** About the size the canvas draws a Node at: enough to keep laid-out Nodes apart. */
const NODE_W = 240;
const nodeHeight = (lib: LibraryNode | undefined) => 72 + 24 * Math.max(lib?.inputs.length ?? 0, lib?.outputs.length ?? 0);

/** The file as the canvas draws it; each file Node `ref` stands in for a library id. */
export function draftView(text: string): DraftView {
  const file = JSON.parse(text) as FlowFile;
  const library = new Map<string, LibraryNode>(file.nodes.map((n) => [n.ref, { id: n.ref, name: n.name, kind: n.kind, inputs: n.inputs, outputs: n.outputs }]));
  const placements = file.placements.map((p) => ({ id: p.id, nodeId: p.node, label: p.label, extraInstructions: p.extraInstructions, enabledOptionalOutputs: p.enabledOptionalOutputs, x: p.x, y: p.y }));
  const edges = file.edges.map((e, i) => ({ id: `e${i + 1}`, fromFlowNodeId: e.from, fromOutput: e.output, toFlowNodeId: e.to, toInput: e.input }));
  return { name: file.name, library, placements, edges };
}

/** The same file with every placement moved to a tidy left-to-right layout (Claude's positions are not trusted). */
export function layOutDraft(text: string): string {
  const file = JSON.parse(text) as FlowFile;
  const byRef = new Map(file.nodes.map((n) => [n.ref, n]));
  const at = layeredLayout(
    file.placements.map((p, i) => ({ id: p.id, x: 0, y: i, w: NODE_W, h: nodeHeight(byRef.get(p.node) as LibraryNode | undefined) })),
    file.edges.map((e) => ({ from: e.from, to: e.to })),
  );
  const placements = file.placements.map((p) => ({ ...p, ...(at.get(p.id) ?? { x: p.x, y: p.y }) }));
  return JSON.stringify({ ...file, placements }, null, 2);
}
