import { describe, expect, it } from "vitest";
import type { LibraryNode } from "@clauderon/core";
import { buildEdges, buildNodes, type FlowEdge, type FlowNode, type GraphEdge, type Placement } from "../src/app/(app)/flows/[id]/graph-cache";

// Editing a Node's label must not hand React Flow new node or edge objects: it
// would re-measure the Node and re-create the edges attached to it (the flicker).

const lib = { id: "lib-1", name: "Code a change", kind: "agent", inputs: [], outputs: [] } as unknown as LibraryNode;
const libById = new Map([[lib.id, lib]]);
const placement = (id: string, x: number): Placement => ({ id, nodeId: lib.id, label: null, extraInstructions: "", enabledOptionalOutputs: [], x, y: 0 });
const edge = (id: string, from: string, to: string): GraphEdge => ({ id, fromFlowNodeId: from, fromOutput: "out", toFlowNodeId: to, toInput: "in" });

describe("flow editor graph cache", () => {
  const a = placement("a", 0);
  const b = placement("b", 200);
  const e1 = edge("e1", "a", "b");
  const none = new Set<string>();

  it("keeps every node and edge object when only a label or instructions change", () => {
    const nodes = buildNodes([a, b], libById, none, new Map<string, FlowNode>());
    const edges = buildEdges([e1], new Map(), none, new Map<string, FlowEdge>());

    const edited = { ...a, label: "Renamed", extraInstructions: "Be careful" };
    const nodes2 = buildNodes([edited, b], libById, none, nodes);
    const edges2 = buildEdges([e1], new Map(), none, edges);

    expect(nodes2.get("a")).toBe(nodes.get("a"));
    expect(nodes2.get("b")).toBe(nodes.get("b"));
    expect(edges2.get("e1")).toBe(edges.get("e1"));
  });

  it("builds a new node when it moves or is selected, and only that node", () => {
    const nodes = buildNodes([a, b], libById, none, new Map<string, FlowNode>());
    const moved = buildNodes([{ ...a, x: 50 }, b], libById, none, nodes);
    expect(moved.get("a")).not.toBe(nodes.get("a"));
    expect(moved.get("b")).toBe(nodes.get("b"));

    const picked = buildNodes([a, b], libById, new Set(["b"]), nodes);
    expect(picked.get("b")?.selected).toBe(true);
    expect(picked.get("a")).toBe(nodes.get("a"));
  });

  it("builds a new edge only when its ends, selection or error change", () => {
    const edges = buildEdges([e1], new Map(), none, new Map<string, FlowEdge>());
    expect(buildEdges([e1], new Map([["e1", "type mismatch"]]), none, edges).get("e1")?.data?.reason).toBe("type mismatch");
    expect(buildEdges([e1], new Map(), new Set(["e1"]), edges).get("e1")?.selected).toBe(true);
    expect(buildEdges([{ ...e1, toInput: "other" }], new Map(), none, edges).get("e1")).not.toBe(edges.get("e1"));
  });

  it("drops nodes whose library Node is gone", () => {
    expect(buildNodes([{ ...a, nodeId: "missing" }], libById, none, new Map<string, FlowNode>()).size).toBe(0);
  });
});
