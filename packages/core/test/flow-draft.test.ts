import { describe, expect, it } from "vitest";
import { agentSupportsFlowDrafts, flowDraftPrompt, flowDraftRepairPrompt, flowDraftRevisePrompt, readFlowDraft, type DraftLibraryNode } from "../src/flow-draft";

const library: DraftLibraryNode[] = [
  { name: "Ticket", kind: "ticket", instructions: "", command: null, inputs: [], outputs: [{ name: "issue", type: "issue", optional: false }] },
  {
    name: "Plan",
    kind: "agent",
    instructions: "Write a plan.",
    command: null,
    inputs: [{ name: "issue", type: "issue", required: true }],
    outputs: [{ name: "plan", type: "plan", optional: false }],
  },
];

const answer = (file: unknown, before = "Here is the Flow.") => `${before}\n\n\`\`\`json\n${JSON.stringify(file)}\n\`\`\``;
const base = {
  format: "clauderon-flow",
  version: 1,
  name: "Plan then review",
  nodes: [
    { ref: "n1", use: "Ticket" },
    { ref: "n2", use: "plan" },
    {
      ref: "n3",
      name: "Review the plan",
      kind: "approve",
      instructions: "Check the plan.",
      command: null,
      inputs: [{ name: "plan", type: "plan", required: true }],
      outputs: [{ name: "plan", type: "plan", optional: false }],
    },
  ],
  placements: [
    { id: "p1", node: "n1", label: null, extraInstructions: "", enabledOptionalOutputs: [], x: 0, y: 0 },
    { id: "p2", node: "n2", label: null, extraInstructions: "Keep it short.", enabledOptionalOutputs: [], x: 0, y: 0 },
    { id: "p3", node: "n3", label: null, extraInstructions: "", enabledOptionalOutputs: [], x: 0, y: 0 },
  ],
  edges: [
    { from: "p1", output: "issue", to: "p2", input: "issue" },
    { from: "p2", output: "plan", to: "p3", input: "plan" },
  ],
};

describe("Flow Draft (ADR 0008)", () => {
  it("reads the last JSON block, expands library Nodes by name and names only the new Nodes", () => {
    const read = readFlowDraft(answer(base), library);
    if (!read.ok) throw new Error(read.error);
    expect(read.file.name).toBe("Plan then review");
    // A `use` becomes the library Node's exact definition, so the import reuses that Node.
    expect(read.file.nodes[1]).toEqual({ ref: "n2", ...library[1] });
    expect(read.file.nodes[0]!.kind).toBe("input");
    expect(read.newNodes).toEqual(["Review the plan"]);
    expect(read.file.placements[1]!.extraInstructions).toBe("Keep it short.");
  });

  it("refuses a Node the library does not have, an answer without JSON, and an invalid Flow", () => {
    expect(readFlowDraft(answer({ ...base, nodes: [...base.nodes.slice(0, 2), { ref: "n3", use: "Nope" }] }), library)).toEqual({
      ok: false,
      error: expect.stringContaining('no library Node named "Nope"'),
    });
    expect(readFlowDraft("I could not do it.", library)).toEqual({ ok: false, error: "the answer holds no JSON object." });
    const cycle = { ...base, edges: [...base.edges, { from: "p3", output: "plan", to: "p3", input: "plan" }] };
    expect(readFlowDraft(answer(cycle), library).ok).toBe(false);
  });

  it("needs exactly one Ticket placement", () => {
    const noTicket = { ...base, placements: base.placements.slice(1), edges: base.edges.slice(1) };
    expect(readFlowDraft(answer(noTicket), library)).toEqual({ ok: false, error: "the Flow needs exactly one placement of an Input Node." });
  });

  it("puts the description, the library and an earlier draft with a note in the prompt", () => {
    const prompt = flowDraftPrompt({ description: "Plan, then let me approve", library, previous: '{"name":"x"}', note: "Add tests" });
    expect(prompt).toContain("Plan, then let me approve");
    expect(prompt).toContain('- "Plan" (agent)');
    expect(prompt).toContain("inputs: issue: issue");
    expect(prompt).toContain('{"name":"x"}');
    expect(prompt).toContain("Add tests");
    expect(flowDraftRevisePrompt("Add tests")).toContain("Add tests");
    expect(flowDraftRepairPrompt("bad edge")).toContain("bad edge");
  });

  it("knows which Agent versions understand Flow Drafts", () => {
    expect(agentSupportsFlowDrafts("0.5.0+abc")).toBe(true);
    expect(agentSupportsFlowDrafts("0.5.0-dev")).toBe(true);
    expect(agentSupportsFlowDrafts("1.0.0")).toBe(true);
    expect(agentSupportsFlowDrafts("0.4.9+abc")).toBe(false);
    expect(agentSupportsFlowDrafts(null)).toBe(false);
  });
});
