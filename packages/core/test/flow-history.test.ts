import { describe, expect, it } from "vitest";
import { describeChange, describeChanges, diffFlow, libraryChanges, maskSnapshot, MASK, type VersionNode, type VersionSnapshot } from "../src/index";

const node = (id: string, name: string, over: Partial<VersionNode> = {}): VersionNode => ({
  id,
  nodeId: `lib-${id}`,
  label: null,
  definition: { name, kind: "agent", instructions: `do ${name}`, command: null, inputs: [], outputs: [] },
  extraInstructions: "",
  enabledOptionalOutputs: [],
  x: 0,
  y: 0,
  ...over,
});
const edge = (id: string, from: string, to: string) => ({ id, fromFlowNodeId: from, fromOutput: "out", toFlowNodeId: to, toInput: "in" });
const snap = (over: Partial<VersionSnapshot> = {}): VersionSnapshot => ({ name: "Ship", nodes: [node("a", "Plan"), node("b", "Implement")], edges: [edge("e1", "a", "b")], ...over });
const words = (before: VersionSnapshot | null, after: VersionSnapshot) => diffFlow(before, after).map(describeChange);

describe("diffFlow and describeChange", () => {
  it("is the baseline for a first version and empty for an equal one", () => {
    expect(words(null, snap())).toEqual(["Existing before history"]);
    expect(diffFlow(snap(), snap())).toEqual([]);
    expect(describeChanges([])).toEqual(["No changes"]);
  });
  it("describes a rename", () => {
    expect(words(snap(), snap({ name: "Release" }))).toEqual(['Flow renamed from "Ship" to "Release"']);
  });
  it("describes Nodes added and removed, using the label when one is set", () => {
    const after = snap({ nodes: [node("a", "Plan"), node("c", "Review", { label: "Check" })], edges: [] });
    expect(words(snap(), after)).toEqual(['Node "Check" added', 'Node "Implement" removed', 'Edge from "Plan" to "Implement" removed']);
  });
  it("describes edited instructions, extra instructions, ports and optional outputs", () => {
    const edited = snap({
      nodes: [
        node("a", "Plan", { definition: { ...node("a", "Plan").definition, instructions: "new" }, extraInstructions: "more" }),
        node("b", "Implement", { enabledOptionalOutputs: ["log"], definition: { ...node("b", "Implement").definition, outputs: [{ name: "log", type: "log", optional: true }] as never } }),
      ],
    });
    expect(words(snap(), edited)).toEqual(['Instructions of "Plan" edited', 'Extra instructions of "Plan" edited', 'Inputs or outputs of "Implement" changed', 'Optional outputs of "Implement" changed']);
  });
  it("describes edges added, removed and rewired", () => {
    const three = [node("a", "Plan"), node("b", "Implement"), node("c", "Review")];
    const before = snap({ nodes: three });
    expect(words(before, snap({ nodes: three, edges: [edge("e1", "a", "b"), edge("e2", "b", "c")] }))).toEqual(['Edge from "Implement" to "Review" added']);
    expect(words(before, snap({ nodes: three, edges: [] }))).toEqual(['Edge from "Plan" to "Implement" removed']);
    expect(words(before, snap({ nodes: three, edges: [edge("e1", "a", "c")] }))).toEqual(['Edge from "Plan" to "Implement" rewired to "Plan" to "Review"']);
  });
  it("reports a move only when nothing else changed", () => {
    expect(words(snap(), snap({ nodes: [node("a", "Plan", { x: 50 }), node("b", "Implement")] }))).toEqual(["Layout changed"]);
    expect(words(snap(), snap({ name: "X", nodes: [node("a", "Plan", { x: 50 }), node("b", "Implement")] }))).toEqual(['Flow renamed from "Ship" to "X"']);
  });
  it("groups changes made in the library per Node", () => {
    const after = snap({ nodes: [node("a", "Plan", { definition: { ...node("a", "Plan").definition, instructions: "new" } }), node("b", "Implement")] });
    expect(libraryChanges(diffFlow(snap(), after)).map(describeChange)).toEqual(['Node "Plan" changed in the library (instructions edited)']);
  });
});

describe("masking (NFR-1)", () => {
  const token = "ghp_" + "a".repeat(30);
  it("hides tokens in instructions, commands and extra instructions of a snapshot", () => {
    const masked = maskSnapshot(snap({ nodes: [node("a", "Plan", { extraInstructions: `use ${token}`, definition: { ...node("a", "Plan").definition, instructions: `Bearer abc.def`, command: `echo ${token}` } })] }));
    const text = JSON.stringify(masked);
    expect(text).not.toContain(token);
    expect(text).not.toContain("abc.def");
    expect(text).toContain(MASK);
  });
  it("hides tokens in a described change", () => {
    expect(describeChange({ type: "node-added", node: `x ${token}` })).not.toContain(token);
  });
});
