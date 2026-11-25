import { describe, expect, it } from "vitest";
import type { FlowEdge, SnapshotNode } from "@clauderon/core";
import { currentNodeId, diagramEdgeStates, diagramPositions, diagramState, nodeSize, type DiagramState } from "../src/app/(app)/runs/[id]/run-diagram";

const node = (id: string, kind: SnapshotNode["kind"] = "agent", inputs = 1, outputs = 1): SnapshotNode => ({
  id,
  nodeId: id,
  name: id,
  kind,
  instructions: "",
  command: null,
  inputs: Array.from({ length: inputs }, (_, i) => ({ name: `in${i}`, type: "plan", required: true }) as SnapshotNode["inputs"][number]),
  outputs: Array.from({ length: outputs }, (_, i) => ({ name: `out${i}`, type: "plan", optional: false }) as SnapshotNode["outputs"][number]),
  extraInstructions: "",
  enabledOptionalOutputs: [],
  x: 0,
  y: 0,
});
const edge = (id: string, from: string, to: string): FlowEdge => ({ id, fromFlowNodeId: from, fromOutput: "out0", toFlowNodeId: to, toInput: "in0" });

describe("Run Flow diagram (#189)", () => {
  it("maps a Node's state to what the canvas shows", () => {
    expect(diagramState("waiting_for_human")).toBe("waiting");
    expect(diagramState("running")).toBe("running");
    expect(diagramState("not reached")).toBe("not reached");
    expect(diagramState("failed")).toBe("failed");
  });

  it("lays the Nodes out left to right, whatever positions the Flow was saved with", () => {
    const nodes = [{ ...node("a", "ticket", 0), x: 900, y: 500 }, { ...node("b"), x: 0, y: 0 }, { ...node("c"), x: 300, y: 900 }];
    const at = diagramPositions(nodes, [edge("e1", "a", "b"), edge("e2", "b", "c")]);
    expect(at.get("a")!.x).toBeLessThan(at.get("b")!.x);
    expect(at.get("b")!.x).toBeLessThan(at.get("c")!.x);
  });

  it("puts Nodes of the same step in one column, side by side", () => {
    const nodes = [node("a", "ticket", 0), node("b"), node("c"), node("d")];
    const at = diagramPositions(nodes, [edge("e1", "a", "b"), edge("e2", "a", "c"), edge("e3", "b", "d"), edge("e4", "c", "d")]);
    expect(at.get("b")!.x).toBe(at.get("c")!.x);
    expect(at.get("b")!.y).not.toBe(at.get("c")!.y);
    expect(at.get("d")!.x).toBeGreaterThan(at.get("b")!.x);
  });

  it("sizes an entry Node as a pill and a card by its ports", () => {
    expect(nodeSize(node("a", "ticket", 0)).h).toBeLessThan(nodeSize(node("b")).h);
    expect(nodeSize(node("c", "agent", 3, 1)).h).toBeGreaterThan(nodeSize(node("d", "agent", 1, 1)).h);
  });

  it("marks an edge done between finished Nodes and active into the Node that is running or waiting", () => {
    const edges = [edge("e1", "a", "b"), edge("e2", "b", "c"), edge("e3", "c", "d")];
    const states = new Map<string, DiagramState>([["a", "succeeded"], ["b", "succeeded"], ["c", "waiting"], ["d", "queued"]]);
    const out = diagramEdgeStates(edges, states);
    expect(out.get("e1")).toBe("done");
    expect(out.get("e2")).toBe("active");
    expect(out.has("e3")).toBe(false);
  });

  it("selects the running Node first, then the failed one, then the last that ran", () => {
    const n = (id: string, state: Parameters<typeof diagramState>[0], attempts = 0) => ({ id, state, attempts: new Array(attempts).fill(0) });
    expect(currentNodeId([n("a", "succeeded", 1), n("b", "running", 1), n("c", "queued")])).toBe("b");
    expect(currentNodeId([n("a", "succeeded", 1), n("b", "failed", 1), n("c", "not reached")])).toBe("b");
    expect(currentNodeId([n("a", "succeeded", 1), n("b", "succeeded", 1), n("c", "queued")])).toBe("b");
    expect(currentNodeId([n("a", "queued"), n("b", "queued")])).toBe("a");
    expect(currentNodeId([])).toBeUndefined();
  });
});
