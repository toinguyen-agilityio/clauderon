import { describe, expect, it } from "vitest";
import { deleteBlocker, filterNodes, kindCounts, saveBlocker, sameValue, type NodeFormValue } from "../src/app/(app)/flows/library/library-view";

const node = (name: string, kind: "agent" | "command" | "approve", over: { instructions?: string; command?: string | null } = {}) => ({
  name,
  kind,
  instructions: over.instructions ?? "",
  command: over.command ?? null,
});

const nodes = [
  node("Code a change", "agent", { instructions: "Make the change the issue asks for." }),
  node("Run tests", "command", { command: "npm test --if-present" }),
  node("Approve a plan", "approve", { instructions: "Read the plan." }),
  node("Summary by Claude Artifact", "agent", { instructions: "Publish a summary as an artifact." }),
];

describe("Node library list (ticket #71)", () => {
  it("filters by name, instructions and command, ignoring case", () => {
    expect(filterNodes(nodes, "RUN", "all").map((n) => n.name)).toEqual(["Run tests"]);
    expect(filterNodes(nodes, "artifact", "all").map((n) => n.name)).toEqual(["Summary by Claude Artifact"]);
    expect(filterNodes(nodes, "npm test", "all").map((n) => n.name)).toEqual(["Run tests"]);
    expect(filterNodes(nodes, "  ", "all")).toHaveLength(4);
  });

  it("filters by Kind, and the two filters combine", () => {
    expect(filterNodes(nodes, "", "agent").map((n) => n.name)).toEqual(["Code a change", "Summary by Claude Artifact"]);
    expect(filterNodes(nodes, "summary", "agent").map((n) => n.name)).toEqual(["Summary by Claude Artifact"]);
    expect(filterNodes(nodes, "summary", "command")).toEqual([]);
  });

  it("counts the Nodes of each Kind that has any", () => {
    expect(kindCounts(nodes)).toEqual([
      { kind: "agent", count: 2 },
      { kind: "command", count: 1 },
      { kind: "approve", count: 1 },
    ]);
  });
});

describe("Node form (ticket #71)", () => {
  const form = (over: Partial<NodeFormValue> = {}): NodeFormValue => ({ id: null, name: "Write notes", kind: "agent", instructions: "Write the notes.", command: null, inputs: [], outputs: [], ...over });

  it("says why Save is unavailable, in the server's words", () => {
    expect(saveBlocker(form({ name: "  " }))).toBe("Give the Node a name.");
    expect(saveBlocker(form({ instructions: "" }))).toBe("An Agent Node needs instructions.");
    expect(saveBlocker(form({ kind: "command", command: "" }))).toBe("A Command Node needs a command.");
    expect(saveBlocker(form({ inputs: [{ name: "Bad Name", type: "issue", required: true }] }))).toContain("lower case letters, digits and dashes");
    expect(saveBlocker(form({ outputs: [{ name: "a", type: "plan", optional: false }, { name: "a", type: "plan", optional: false }] }))).toBe("Two Outputs have the same name.");
  });

  it("allows Save for a complete form", () => {
    expect(saveBlocker(form())).toBeNull();
    expect(saveBlocker(form({ kind: "command", command: "npm test", instructions: "" }))).toBeNull();
    expect(saveBlocker(form({ kind: "approve", instructions: "" }))).toBeNull();
  });

  it("blocks Delete while a Flow places the Node, and names the Flows", () => {
    expect(deleteBlocker([])).toBeNull();
    expect(deleteBlocker([{ flowId: "1", name: "Plan and deliver", locked: false }])).toBe("Used by Plan and deliver. Take it out of that Flow first.");
    expect(
      deleteBlocker([
        { flowId: "1", name: "A", locked: false },
        { flowId: "2", name: "B", locked: true },
      ]),
    ).toBe("Used by A, B. Take it out of those Flows first.");
  });

  it("tells unsaved changes from a saved form", () => {
    expect(sameValue(form(), form())).toBe(true);
    expect(sameValue(form(), form({ name: "Other" }))).toBe(false);
  });
});
