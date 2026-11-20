import { describe, expect, it } from "vitest";
import { filterFlows, groupFlows, pipelinePreview, problemsLabel, scopeCounts, type FlowRowView } from "../src/app/(app)/flows/flows-view";

const flow = (name: string, over: Partial<FlowRowView> = {}): FlowRowView => ({
  id: name,
  name,
  isSample: false,
  nodeCount: 2,
  problems: 0,
  nodes: [
    { name: "Ticket", kind: "ticket" },
    { name: "Code a change", kind: "agent" },
  ],
  updatedBy: "ann@example.com",
  updatedLabel: "1 h ago",
  updatedTitle: "2026-11-18 10:00 UTC",
  lock: null,
  ...over,
});

const flows = [
  flow("Brainstorm and deliver PR", { nodes: [{ name: "Grill a plan", kind: "grill" }] }),
  flow("Basic ticket delivery with Artifact", { problems: 2 }),
  flow("Plan and deliver", { isSample: true }),
  flow("Basic ticket delivery", { isSample: true }),
];

describe("Flows list (ticket: Flows UI)", () => {
  it("searches by Flow name and by the name of a Node in it, ignoring case", () => {
    expect(filterFlows(flows, "PLAN AND", "all").map((f) => f.name)).toEqual(["Plan and deliver"]);
    expect(filterFlows(flows, "grill", "all").map((f) => f.name)).toEqual(["Brainstorm and deliver PR"]);
    expect(filterFlows(flows, "  ", "all")).toHaveLength(4);
    expect(filterFlows(flows, "nothing like this", "all")).toEqual([]);
  });

  it("filters by scope, and the two filters combine", () => {
    expect(filterFlows(flows, "", "mine").map((f) => f.name)).toEqual(["Brainstorm and deliver PR", "Basic ticket delivery with Artifact"]);
    expect(filterFlows(flows, "", "samples").map((f) => f.name)).toEqual(["Plan and deliver", "Basic ticket delivery"]);
    expect(filterFlows(flows, "", "problems").map((f) => f.name)).toEqual(["Basic ticket delivery with Artifact"]);
    expect(filterFlows(flows, "basic", "samples").map((f) => f.name)).toEqual(["Basic ticket delivery"]);
  });

  it("counts the Flows in each scope", () => {
    expect(scopeCounts(flows)).toEqual({ all: 4, mine: 2, samples: 2, problems: 1 });
  });

  it("puts the samples apart from the Flows people made, keeping each group's order", () => {
    const { samples, mine } = groupFlows(flows);
    expect(samples.map((f) => f.name)).toEqual(["Plan and deliver", "Basic ticket delivery"]);
    expect(mine.map((f) => f.name)).toEqual(["Brainstorm and deliver PR", "Basic ticket delivery with Artifact"]);
    expect(groupFlows([])).toEqual({ samples: [], mine: [] });
  });

  it("previews the first Nodes and says how many are left out", () => {
    const nodes = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(pipelinePreview(nodes)).toEqual({ shown: [1, 2, 3, 4, 5, 6], hidden: [7, 8] });
    expect(pipelinePreview(nodes.slice(0, 3))).toEqual({ shown: [1, 2, 3], hidden: [] });
  });

  it("words the problem count", () => {
    expect(problemsLabel(1)).toBe("1 problem");
    expect(problemsLabel(3)).toBe("3 problems");
  });
});
