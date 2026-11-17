import { NODE_KINDS, OUTPUT_TYPES, type NodeInput, type NodeKind, type NodeOutput } from "./flow";

// What a Member may enter for a library Node (spec M2 §4, FLW-1, FLW-9).

export type NodeDefinition = {
  name: string;
  kind: NodeKind;
  /** The prompt of an Agent Node, or the guidance of a Human one. */
  instructions: string;
  /** The shell command of a Command Node. */
  command: string | null;
  inputs: NodeInput[];
  outputs: NodeOutput[];
};

/** Kinds a Member can create; the Ticket entry Node is a sample only. */
export const CREATABLE_KINDS = NODE_KINDS.filter((k) => k !== "ticket");

export type DefinitionCheck = { ok: true; definition: NodeDefinition } | { ok: false; error: string };

const portNames = (ports: readonly { name: string }[]) => ports.map((p) => p.name);
const hasDuplicate = (names: readonly string[]) => new Set(names).size !== names.length;
const PORT_NAME = /^[a-z][a-z0-9-]{0,39}$/;

/** Cleans and checks a Node definition; the first thing wrong is the answer. */
export function checkNodeDefinition(raw: {
  name?: unknown;
  kind?: unknown;
  instructions?: unknown;
  command?: unknown;
  inputs?: unknown;
  outputs?: unknown;
}): DefinitionCheck {
  const name = String(raw.name ?? "").trim();
  if (!name) return { ok: false, error: "Give the Node a name." };
  if (name.length > 120) return { ok: false, error: "The name is at most 120 characters." };

  const kind = String(raw.kind) as NodeKind;
  if (!NODE_KINDS.includes(kind)) return { ok: false, error: "Pick a kind." };
  if (kind === "ticket") return { ok: false, error: "The Ticket Node is a sample; a Flow has exactly one of it." };

  const instructions = String(raw.instructions ?? "").trim().slice(0, 20_000);
  const command = raw.command == null ? null : String(raw.command).trim();
  if (kind === "command" && !command) return { ok: false, error: "A Command Node needs a command." };
  if (kind === "agent" && !instructions) return { ok: false, error: "An Agent Node needs instructions." };

  if (!Array.isArray(raw.inputs) || !Array.isArray(raw.outputs)) return { ok: false, error: "Inputs and Outputs must be lists." };
  const inputs: NodeInput[] = [];
  for (const i of raw.inputs as NodeInput[]) {
    const inputName = String(i?.name ?? "").trim();
    if (!PORT_NAME.test(inputName)) return { ok: false, error: `Input name "${inputName}" must be lower case letters, digits and dashes.` };
    if (!(OUTPUT_TYPES as readonly string[]).includes(i.type)) return { ok: false, error: `Input ${inputName} needs an Output Type.` };
    inputs.push({ name: inputName, type: i.type, required: Boolean(i.required) });
  }
  const outputs: NodeOutput[] = [];
  for (const o of raw.outputs as NodeOutput[]) {
    const outputName = String(o?.name ?? "").trim();
    if (!PORT_NAME.test(outputName)) return { ok: false, error: `Output name "${outputName}" must be lower case letters, digits and dashes.` };
    if (!(OUTPUT_TYPES as readonly string[]).includes(o.type)) return { ok: false, error: `Output ${outputName} needs an Output Type.` };
    outputs.push({ name: outputName, type: o.type, optional: Boolean(o.optional) });
  }
  if (hasDuplicate(portNames(inputs))) return { ok: false, error: "Two inputs have the same name." };
  if (hasDuplicate(portNames(outputs))) return { ok: false, error: "Two Outputs have the same name." };

  return { ok: true, definition: { name, kind, instructions, command: kind === "command" ? command : null, inputs, outputs } };
}
