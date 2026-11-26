import { NODE_KINDS, OUTPUT_TYPES, isEntryKind, type NodeInput, type NodeKind, type NodeOutput } from "./flow";

// What a Member may enter for a library Node (spec M2 §4, FLW-1, FLW-9).

/** The Claude models an Agent or Grill Node can run on (#218); none means the Member's own default. */
export const CLAUDE_MODELS = ["opus", "sonnet", "haiku"] as const;
export type ClaudeModel = (typeof CLAUDE_MODELS)[number];

/**
 * Turns one Claude session may take before it pauses for a person (#218): a safety net against an
 * Agent going in circles, not a quota, so a normal Ticket never reaches it.
 */
export const DEFAULT_MAX_TURNS = 200;
export const MAX_TURNS_LIMIT = 1_000;
/** The turns a person gives with Continue. */
export const CONTINUE_TURNS = 50;

/** Whether a Node of this kind runs a Claude session, so has a model and a turn limit. */
export const runsClaude = (kind: NodeKind): boolean => kind === "agent" || kind === "grill";

export type NodeDefinition = {
  name: string;
  kind: NodeKind;
  /** The prompt of an Agent Node, or the guidance of a Human one. */
  instructions: string;
  /** The shell command of a Command Node. */
  command: string | null;
  inputs: NodeInput[];
  outputs: NodeOutput[];
  /** Agent and Grill only (#218); null runs on the Member's default model. Absent in files and older callers. */
  model?: ClaudeModel | null;
  /** Agent and Grill only (#218); null means `DEFAULT_MAX_TURNS`. */
  maxTurns?: number | null;
};

/** Kinds a Member can create; Input Nodes are samples only, one per Input Type. */
export const CREATABLE_KINDS = NODE_KINDS.filter((k) => !isEntryKind(k));

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
  model?: unknown;
  maxTurns?: unknown;
}): DefinitionCheck {
  const name = String(raw.name ?? "").trim();
  if (!name) return { ok: false, error: "Give the Node a name." };
  if (name.length > 120) return { ok: false, error: "The name is at most 120 characters." };

  const kind = String(raw.kind) as NodeKind;
  if (!NODE_KINDS.includes(kind)) return { ok: false, error: "Pick a kind." };
  if (isEntryKind(kind)) return { ok: false, error: "Input Nodes are samples; a Flow has exactly one of them." };

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
    if (i.group !== undefined && !PORT_NAME.test(String(i.group))) return { ok: false, error: `Input ${inputName} has an invalid group.` };
    // Keys in jsonb's stored order: imports compare definitions by their JSON text.
    inputs.push({ name: inputName, type: i.type, ...(i.group === undefined ? {} : { group: String(i.group) }), required: Boolean(i.required) });
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

  const model = raw.model == null || raw.model === "" ? null : String(raw.model);
  if (model !== null && !(CLAUDE_MODELS as readonly string[]).includes(model)) return { ok: false, error: `Pick a model: ${CLAUDE_MODELS.join(", ")} or the default.` };
  const maxTurns = raw.maxTurns == null || raw.maxTurns === "" ? null : Number(raw.maxTurns);
  if (maxTurns !== null && (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > MAX_TURNS_LIMIT)) {
    return { ok: false, error: `The turn limit is a whole number from 1 to ${MAX_TURNS_LIMIT}.` };
  }

  const claude = runsClaude(kind);
  return {
    ok: true,
    definition: {
      name,
      kind,
      instructions,
      command: kind === "command" ? command : null,
      inputs,
      outputs,
      // Only when set, so Flow and Node files and their comparisons stay as they were.
      ...(claude && model ? { model: model as ClaudeModel } : {}),
      ...(claude && maxTurns ? { maxTurns } : {}),
    },
  };
}
