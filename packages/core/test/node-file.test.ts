import { describe, expect, it } from "vitest";
import { buildNodeFile, parseNodeFile } from "../src";

const agent = { name: "Review", kind: "agent", instructions: "Review it.", command: null, inputs: [], outputs: [{ name: "summary", type: "summary", optional: false }] };
const file = (...nodes: object[]) => JSON.stringify({ format: "clauderon-nodes", version: 1, nodes });

describe("Node file (issue #116)", () => {
  it("reads valid Nodes and sets Ticket entries aside", () => {
    const r = parseNodeFile(file(agent, { ...agent, name: "Ticket", kind: "ticket" }));
    expect(r).toMatchObject({ ok: true, parsed: { tickets: ["Ticket"] } });
    expect(r.ok && r.parsed.definitions.map((d) => d.name)).toEqual(["Review"]);
  });

  it("fails the whole file naming the bad Node", () => {
    expect(parseNodeFile(file(agent, { ...agent, name: "Bad", instructions: "" }))).toEqual({ ok: false, error: 'Node "Bad": An Agent Node needs instructions.' });
    expect(parseNodeFile("nope")).toMatchObject({ ok: false });
    expect(parseNodeFile(file())).toMatchObject({ ok: false });
  });

  it("builds a file with only definitions and masks tokens", () => {
    const built = buildNodeFile([{ name: "A", kind: "command", instructions: "", command: "curl -H 'x: ghp_abcdefghijklmnopqrstuvwxyz0123456789'", inputs: [], outputs: [] }]);
    expect(JSON.stringify(built)).not.toContain("ghp_abcdef");
    expect(Object.keys(built.nodes[0]!).sort()).toEqual(["command", "inputs", "instructions", "kind", "name", "outputs"]);
  });
});
