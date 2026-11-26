import { describe, expect, it } from "vitest";
import { MAX_TURNS_LIMIT, checkNodeDefinition } from "../src/index";

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

describe("model and turn limit (#218)", () => {
  const agent = { name: "Code", kind: "agent", instructions: "Do it.", command: null, inputs: [], outputs: [] };

  it("keeps a known model and a turn limit on an Agent or Grill Node", () => {
    expect(checkNodeDefinition({ ...agent, model: "haiku", maxTurns: "80" })).toMatchObject({ ok: true, definition: { model: "haiku", maxTurns: 80 } });
    expect(checkNodeDefinition({ ...agent, model: "", maxTurns: "" })).toMatchObject({ ok: true });
    expect(checkNodeDefinition({ ...agent, model: "", maxTurns: "" })).not.toHaveProperty("definition.model");
  });

  it("refuses an unknown model or a turn limit out of range", () => {
    expect(checkNodeDefinition({ ...agent, model: "gpt" })).toMatchObject({ ok: false });
    expect(checkNodeDefinition({ ...agent, maxTurns: 0 })).toMatchObject({ ok: false });
    expect(checkNodeDefinition({ ...agent, maxTurns: MAX_TURNS_LIMIT + 1 })).toMatchObject({ ok: false });
  });

  it("drops both on a Node that runs no Claude session", () => {
    expect(checkNodeDefinition({ ...agent, kind: "command", command: "npm test", model: "opus", maxTurns: 10 })).not.toHaveProperty("definition.model");
  });
});
