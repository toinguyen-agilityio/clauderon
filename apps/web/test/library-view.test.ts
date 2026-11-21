import { describe, expect, it } from "vitest";
import { copyName, deleteBlocker, filterNodes, groupCounts, groupNodes, kindGroupOf, kindLabel, retypePort, saveBlocker, saveOutcome, sameValue, usageLabel, type NodeFormValue } from "../src/app/(app)/flows/library/library-view";

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

  it("filters by Kind group, and the two filters combine", () => {
    expect(filterNodes(nodes, "", "agent").map((n) => n.name)).toEqual(["Code a change", "Summary by Claude Artifact"]);
    expect(filterNodes(nodes, "summary", "agent").map((n) => n.name)).toEqual(["Summary by Claude Artifact"]);
    expect(filterNodes(nodes, "summary", "command")).toEqual([]);
    expect(filterNodes(nodes, "", "human").map((n) => n.name)).toEqual(["Approve a plan"]);
  });

  it("also finds Nodes by port name and Output Type", () => {
    const withPorts = [
      { ...node("Code a change", "agent"), inputs: [{ name: "issue", type: "issue" as const, required: true }], outputs: [{ name: "branch", type: "branch" as const, optional: false }] },
      { ...node("Run tests", "command", { command: "npm test" }), inputs: [], outputs: [{ name: "result", type: "test-result" as const, optional: false }] },
    ];
    expect(filterNodes(withPorts, "TEST-RESULT", "all").map((n) => n.name)).toEqual(["Run tests"]);
    expect(filterNodes(withPorts, "branch", "all").map((n) => n.name)).toEqual(["Code a change"]);
  });

  it("groups approve and grill as Human, and counts each group that has any in a fixed order", () => {
    expect(kindGroupOf("approve")).toBe("human");
    expect(kindGroupOf("grill")).toBe("human");
    expect(kindGroupOf("agent")).toBe("agent");
    expect(groupCounts([...nodes, node("Grill a plan", "approve")])).toEqual([
      { group: "agent", count: 2 },
      { group: "command", count: 1 },
      { group: "human", count: 2 },
    ]);
  });

  it("puts the Nodes under their Kind group, in the groups' order, leaving out empty groups", () => {
    const grouped = groupNodes([node("Run tests", "command"), node("Approve a plan", "approve"), node("Code a change", "agent")]);
    expect(grouped.map((g) => [g.group, g.nodes.map((n) => n.name)])).toEqual([
      ["agent", ["Code a change"]],
      ["command", ["Run tests"]],
      ["human", ["Approve a plan"]],
    ]);
    expect(groupNodes([])).toEqual([]);
  });

  it("renames a port after its new type while it was named after the old one", () => {
    expect(retypePort({ name: "issue", type: "issue", required: true }, "plan")).toEqual({ name: "plan", type: "plan", required: true });
    expect(retypePort({ name: "", type: "issue", required: true }, "plan").name).toBe("plan");
    expect(retypePort({ name: "ticket", type: "issue", required: true }, "plan").name).toBe("ticket");
  });

  it("says how many Flows place a Node, and names its Kind", () => {
    expect(usageLabel([{ flowId: "a", name: "A", locked: false }, { flowId: "b", name: "B", locked: false }])).toBe("Used in 2 Flows");
    expect(usageLabel([{ flowId: "a", name: "A", locked: false }])).toBe("Used in 1 Flow");
    expect(usageLabel([])).toBe("Not used in any Flow");
    expect(kindLabel("grill")).toBe("Human · Grill");
    expect(kindLabel("agent")).toBe("Agent");
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

describe("New Node modal after saving (issue #90)", () => {
  it("closes the dialog when a Node is created", () => {
    const o = saveOutcome({ ok: true, flows: 0, withProblems: 0 }, true);
    expect(o.close).toBe(true);
    expect(o.message.kind).toBe("ok");
  });

  it("stays open and shows the error when creating fails", () => {
    const o = saveOutcome({ ok: false, error: "Name already used" }, true);
    expect(o.close).toBe(false);
    expect(o.message).toEqual({ kind: "error", text: "Name already used" });
  });

  it("keeps an edited Node open and says how many Flows changed", () => {
    const o = saveOutcome({ ok: true, flows: 2, withProblems: 1 }, false);
    expect(o.close).toBe(false);
    expect(o.message.text).toBe("Saved. It changed 2 Flows; 1 now has problems.");
  });
});

describe("copyName (issue #94)", () => {
  it("names a copy 'Copy of <name>'", () => {
    expect(copyName("Code a change", ["Code a change"])).toBe("Copy of Code a change");
  });

  it("avoids a name that is already taken, ignoring case", () => {
    expect(copyName("Code a change", ["Code a change", "copy of code a change"])).toBe("Copy of Code a change (2)");
    expect(copyName("Code a change", ["Copy of Code a change", "Copy of Code a change (2)"])).toBe("Copy of Code a change (3)");
  });

  it("stays within 120 characters", () => {
    const long = "x".repeat(120);
    expect(copyName(long, []).length).toBe(120);
    expect(copyName(long, [copyName(long, [])]).length).toBe(120);
  });
});
