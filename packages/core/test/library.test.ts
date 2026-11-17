import { describe, expect, it } from "vitest";
import { checkNodeDefinition } from "../src/index";

const valid = {
  name: "  Lint  ",
  kind: "command",
  instructions: "",
  command: " npm run lint ",
  inputs: [{ name: "branch", type: "branch", required: true }],
  outputs: [{ name: "report", type: "summary", optional: true }],
};

describe("checkNodeDefinition (FLW-1)", () => {
  it("accepts a Command Node and trims what was typed", () => {
    expect(checkNodeDefinition(valid)).toEqual({
      ok: true,
      definition: { name: "Lint", kind: "command", instructions: "", command: "npm run lint", inputs: valid.inputs, outputs: valid.outputs },
    });
  });

  it("refuses an empty name, an unknown kind and the Ticket kind", () => {
    expect(checkNodeDefinition({ ...valid, name: " " })).toEqual({ ok: false, error: "Give the Node a name." });
    expect(checkNodeDefinition({ ...valid, kind: "robot" })).toEqual({ ok: false, error: "Pick a kind." });
    expect(checkNodeDefinition({ ...valid, kind: "ticket" })).toMatchObject({ ok: false });
  });

  it("needs a command for Command Nodes and instructions for Agent Nodes", () => {
    expect(checkNodeDefinition({ ...valid, command: "" })).toEqual({ ok: false, error: "A Command Node needs a command." });
    expect(checkNodeDefinition({ ...valid, kind: "agent", instructions: "" })).toEqual({ ok: false, error: "An Agent Node needs instructions." });
    expect(checkNodeDefinition({ ...valid, kind: "agent", instructions: "Do it." })).toMatchObject({ ok: true, definition: { command: null } });
  });

  it("refuses bad or duplicate port names and unknown Output Types", () => {
    expect(checkNodeDefinition({ ...valid, inputs: [{ name: "Bad Name", type: "branch", required: true }] })).toMatchObject({ ok: false });
    expect(checkNodeDefinition({ ...valid, outputs: [{ name: "a", type: "nope", optional: false }] })).toMatchObject({ ok: false });
    const twice = { name: "x", type: "summary", optional: false };
    expect(checkNodeDefinition({ ...valid, outputs: [twice, twice] })).toEqual({ ok: false, error: "Two Outputs have the same name." });
  });
});
