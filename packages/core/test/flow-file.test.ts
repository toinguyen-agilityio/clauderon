import { describe, expect, it } from "vitest";
import { buildFlowFile, FLOW_FILE_FORMAT, FLOW_FILE_VERSION, parseFlowFile, type FlowToExport } from "../src/flow-file";

const ticket = { inputs: [], outputs: [{ name: "issue", type: "issue" as const, optional: false }] };
const def = (over: Record<string, unknown> = {}) => ({
  name: "Code a change",
  kind: "agent" as const,
  instructions: "Make the change.",
  command: null,
  inputs: [{ name: "issue", type: "issue" as const, required: true }],
  outputs: [{ name: "branch", type: "branch" as const, optional: false }],
  ...over,
});
const flow: FlowToExport = {
  name: "Ship it",
  placements: [
    { id: "uuid-a", definition: { name: "Ticket", kind: "ticket", instructions: "", command: null, inputs: [], outputs: ticket.outputs }, label: null, extraInstructions: "", enabledOptionalOutputs: [], x: 0, y: 0 },
    { id: "uuid-b", definition: def(), label: "Code", extraInstructions: "Be brief.", enabledOptionalOutputs: [], x: 300, y: 0 },
  ],
  edges: [{ fromFlowNodeId: "uuid-a", fromOutput: "issue", toFlowNodeId: "uuid-b", toInput: "issue" }],
};
const file = (over: Record<string, unknown> = {}) => JSON.stringify({ ...buildFlowFile(flow), ...over });

describe("Flow file (issue #98)", () => {
  it("round trips: what is exported is read back with the same Nodes, positions and edges", () => {
    const parsed = parseFlowFile(JSON.stringify(buildFlowFile(flow)), ticket);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.flow.name).toBe("Ship it");
    expect(parsed.flow.nodes.map((n) => [n.definition.name, n.isTicket])).toEqual([
      ["Ticket", true],
      ["Code a change", false],
    ]);
    expect(parsed.flow.nodes[1]!.definition).toEqual(def());
    expect(parsed.flow.placements.map((p) => [p.label, p.extraInstructions, p.x, p.y])).toEqual([
      [null, "", 0, 0],
      ["Code", "Be brief.", 300, 0],
    ]);
    expect(parsed.flow.edges).toEqual([{ from: "p1", output: "issue", to: "p2", input: "issue" }]);
  });

  it("lists a Node once however often it is placed, and carries no ids, emails or dates", () => {
    const twice = buildFlowFile({ ...flow, placements: [...flow.placements, { ...flow.placements[1]!, id: "uuid-c" }] });
    expect(twice.nodes).toHaveLength(2);
    expect(twice.placements).toHaveLength(3);
    const text = JSON.stringify(twice);
    expect(text).not.toContain("uuid-");
    expect(text).not.toMatch(/@|createdAt|updatedAt|updatedBy/);
    expect(twice.format).toBe(FLOW_FILE_FORMAT);
    expect(twice.version).toBe(FLOW_FILE_VERSION);
  });

  it("masks tokens typed into instructions or a command", () => {
    const token = "ghp_" + "a".repeat(30);
    const built = buildFlowFile({ ...flow, placements: [{ ...flow.placements[1]!, definition: def({ instructions: "Use " + token }), extraInstructions: "Bearer abc123" }] });
    const text = JSON.stringify(built);
    expect(text).not.toContain(token);
    expect(text).not.toContain("abc123");
  });

  it.each([
    ["not JSON", "{oops", "not valid JSON"],
    ["another kind of JSON", JSON.stringify({ hello: 1 }), "not a Clauderon Flow file"],
    ["an unknown version", file({ version: 99 }), "version 99"],
    ["no name", file({ name: " " }), "no name"],
    ["a Node with a bad port name", file({ nodes: [{ ref: "n1", name: "A", kind: "agent", instructions: "x", command: null, inputs: [{ name: "Bad Name", type: "issue", required: true }], outputs: [] }, ...buildFlowFile(flow).nodes.slice(1)] }), "lower case"],
    ["a placement of an unknown Node", file({ placements: [{ ...buildFlowFile(flow).placements[0]!, node: "zzz" }] }), "not in the file"],
    ["an edge to a Node that is not placed", file({ edges: [{ from: "p1", output: "issue", to: "p9", input: "issue" }] }), "not placed"],
  ])("refuses %s", (_what, text, message) => {
    const parsed = parseFlowFile(text, ticket);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain(message);
  });

  it("reads the file's own Ticket Node when the install has none, if it fits the Ticket contract", () => {
    const parsed = parseFlowFile(JSON.stringify(buildFlowFile(flow)), null);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.flow.nodes[0]).toMatchObject({ isTicket: true, definition: { kind: "ticket", name: "Ticket", inputs: [], outputs: ticket.outputs } });
    const bad = (over: Record<string, unknown>) => parseFlowFile(file({ nodes: [{ ...buildFlowFile(flow).nodes[0]!, ...over }, ...buildFlowFile(flow).nodes.slice(1)] }), null);
    expect(bad({ outputs: [{ name: "plan", type: "plan", optional: false }] }).ok).toBe(false);
    expect(bad({ outputs: [{ name: "issue", type: "issue", optional: true }] }).ok).toBe(false);
    expect(bad({ inputs: [{ name: "issue", type: "issue", required: true }] }).ok).toBe(false);
  });

  it("refuses a type mismatch and a cycle, with the editor's rules", () => {
    const built = buildFlowFile(flow);
    // issue -> an input of another type
    const wrongType = parseFlowFile(
      JSON.stringify({ ...built, nodes: [built.nodes[0], { ...built.nodes[1], inputs: [{ name: "issue", type: "plan", required: true }] }] }),
      ticket,
    );
    expect(wrongType).toMatchObject({ ok: false, error: expect.stringContaining("does not match") });

    const loop = parseFlowFile(
      JSON.stringify({
        ...built,
        nodes: [built.nodes[0], { ...built.nodes[1], inputs: [{ name: "x", type: "branch", required: false }], outputs: [{ name: "branch", type: "branch", optional: false }] }],
        edges: [{ from: "p2", output: "branch", to: "p2", input: "x" }],
      }),
      ticket,
    );
    expect(loop).toMatchObject({ ok: false, error: expect.stringContaining("cycle") });
  });

  it("accepts an unfinished Flow, as the editor saves those too", () => {
    expect(parseFlowFile(JSON.stringify({ ...buildFlowFile(flow), edges: [] }), ticket).ok).toBe(true);
  });
});
