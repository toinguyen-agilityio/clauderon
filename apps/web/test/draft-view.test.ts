import { describe, expect, it } from "vitest";
import { draftView, layOutDraft } from "../src/app/(app)/flows/draft-view";

const file = JSON.stringify({
  format: "clauderon-flow",
  version: 1,
  name: "Plan it",
  nodes: [
    { ref: "n1", name: "Ticket", kind: "ticket", instructions: "", command: null, inputs: [], outputs: [{ name: "issue", type: "issue", optional: false }] },
    { ref: "n2", name: "Plan", kind: "agent", instructions: "Plan.", command: null, inputs: [{ name: "issue", type: "issue", required: true }], outputs: [{ name: "plan", type: "plan", optional: false }] },
  ],
  placements: [
    { id: "p2", node: "n2", label: "Plan it", extraInstructions: "", enabledOptionalOutputs: [], x: 0, y: 0 },
    { id: "p1", node: "n1", label: null, extraInstructions: "", enabledOptionalOutputs: [], x: 0, y: 0 },
  ],
  edges: [{ from: "p1", output: "issue", to: "p2", input: "issue" }],
});

describe("Flow Draft preview (ADR 0008)", () => {
  it("draws file Nodes as library Nodes keyed by ref, and edges between placements", () => {
    const view = draftView(file);
    expect(view.name).toBe("Plan it");
    expect(view.library.get("n2")).toMatchObject({ id: "n2", name: "Plan", kind: "agent" });
    expect(view.placements.map((p) => [p.id, p.nodeId, p.label])).toEqual([
      ["p2", "n2", "Plan it"],
      ["p1", "n1", null],
    ]);
    expect(view.edges).toEqual([{ id: "e1", fromFlowNodeId: "p1", fromOutput: "issue", toFlowNodeId: "p2", toInput: "issue" }]);
  });

  it("lays the Nodes out left to right along the edges, ignoring Claude's positions", () => {
    const laid = JSON.parse(layOutDraft(file)) as { placements: { id: string; x: number }[] };
    const x = Object.fromEntries(laid.placements.map((p) => [p.id, p.x]));
    expect(x.p2!).toBeGreaterThan(x.p1!);
  });
});
