import { describe, expect, it } from "vitest";
import { filterFlows, flowSteps, groupFlows, problemsLabel, scopeCounts, type FlowRowView } from "../src/app/(app)/flows/flows-view";

const flow = (name: string, over: Partial<FlowRowView> = {}): FlowRowView => ({
  id: name,
  name,
  isSample: false,
  nodeCount: 2,
  problems: 0,
  nodes: [
    { name: "Ticket", kind: "ticket", step: 0 },
    { name: "Code a change", kind: "agent", step: 1 },
  ],
  updatedBy: "ann@example.com",
  updatedLabel: "1 h ago",
  updatedTitle: "2026-11-18 10:00 UTC",
  lock: null,
  ...over,
});

const flows = [
  flow("Brainstorm and deliver PR", { nodes: [{ name: "Grill a plan", kind: "grill", step: 0 }] }),
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

  it("groups the Nodes by step, so Nodes that run side by side share one", () => {
    const n = (name: string, step: number) => ({ name, step });
    expect(flowSteps([n("Ticket", 0), n("Code", 1), n("Tests", 2), n("Shots", 2), n("PR", 3)]).map((s) => s.map((x) => x.name))).toEqual([["Ticket"], ["Code"], ["Tests", "Shots"], ["PR"]]);
    // a gap in the steps (a Node of a cycle) leaves no empty group
    expect(flowSteps([n("A", 0), n("B", 2)]).map((s) => s.map((x) => x.name))).toEqual([["A"], ["B"]]);
    expect(flowSteps([])).toEqual([]);
  });

  it("words the problem count", () => {
    expect(problemsLabel(1)).toBe("1 problem");
    expect(problemsLabel(3)).toBe("3 problems");
  });
});
