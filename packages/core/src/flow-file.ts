import { mask } from "./mask";
import { checkNodeDefinition, type NodeDefinition } from "./library";
import { INPUT_TYPES, validateFlow, type NodeInput, type NodeOutput, type ProblemCode } from "./flow";

// Exporting a Flow to a file and importing it (issue #98). The file holds the Flow's name, the
// definitions of the Nodes it uses, where they sit and how they connect: no ids, emails, dates
// or tokens, so it can be passed to another person or another install.

export const FLOW_FILE_FORMAT = "clauderon-flow";
export const FLOW_FILE_VERSION = 1;
export const FLOW_FILE_MAX_BYTES = 1_000_000;

const MAX_NODES = 100;
const MAX_PLACEMENTS = 200;
const MAX_EDGES = 400;

export type FlowFile = {
  format: typeof FLOW_FILE_FORMAT;
  version: typeof FLOW_FILE_VERSION;
  name: string;
  /** Node definitions, each once, however many times the Flow places it. */
  nodes: { ref: string; name: string; kind: NodeDefinition["kind"]; instructions: string; command: string | null; inputs: NodeInput[]; outputs: NodeOutput[] }[];
  placements: { id: string; node: string; label: string | null; extraInstructions: string; enabledOptionalOutputs: string[]; x: number; y: number }[];
  edges: { from: string; output: string; to: string; input: string }[];
};

export type FlowToExport = {
  name: string;
  placements: { id: string; definition: NodeDefinition; label: string | null; extraInstructions: string; enabledOptionalOutputs: string[]; x: number; y: number }[];
  edges: { fromFlowNodeId: string; fromOutput: string; toFlowNodeId: string; toInput: string }[];
};

/** The file for a Flow. Known token patterns are masked out of the free text, as for logs (NFR-1). */
export function buildFlowFile(flow: FlowToExport): FlowFile {
  const refs = new Map<string, string>();
  const nodes: FlowFile["nodes"] = [];
  const placementIds = new Map<string, string>();
  const placements = flow.placements.map((p, i) => {
    const key = JSON.stringify(p.definition);
    let ref = refs.get(key);
    if (!ref) {
      ref = `n${refs.size + 1}`;
      refs.set(key, ref);
      const d = p.definition;
      nodes.push({ ref, name: d.name, kind: d.kind, instructions: mask(d.instructions), command: d.command === null ? null : mask(d.command), inputs: d.inputs, outputs: d.outputs });
    }
    placementIds.set(p.id, `p${i + 1}`);
    return { id: `p${i + 1}`, node: ref, label: p.label === null ? null : mask(p.label), extraInstructions: mask(p.extraInstructions), enabledOptionalOutputs: p.enabledOptionalOutputs, x: p.x, y: p.y };
  });
  const edges = flow.edges.flatMap((e) => {
    const from = placementIds.get(e.fromFlowNodeId);
    const to = placementIds.get(e.toFlowNodeId);
    return from && to ? [{ from, output: e.fromOutput, to, input: e.toInput }] : [];
  });
  return { format: FLOW_FILE_FORMAT, version: FLOW_FILE_VERSION, name: flow.name, nodes, placements, edges };
}

export type ParsedFlow = {
  name: string;
  nodes: { ref: string; definition: NodeDefinition; isEntry: boolean }[];
  placements: FlowFile["placements"];
  edges: FlowFile["edges"];
};
export type ParseResult = { ok: true; flow: ParsedFlow } | { ok: false; error: string };

// Problems that make a file wrong, as opposed to a Flow that is merely unfinished (an input with
// no edge): the editor saves unfinished Flows too, so they can be exported and imported.
const FATAL: ReadonlySet<ProblemCode> = new Set(["cycle", "type-mismatch", "input-taken", "unknown-node", "unknown-port"]);

const ENTRY_KINDS: ReadonlySet<unknown> = new Set(["ticket", "input"]);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const fail = (error: string): ParseResult => ({ ok: false, error });

/**
 * Reads a Flow file, checking it with the rules the editor applies (typed edges, one edge per
 * input, no cycles). Nothing is created from a file that fails. `entries` are the Input Nodes of
 * this install: an Input in the file means the one with the same Output Type (a `ticket` entry
 * from an older file means `issue`). When there is none, the file's own Node is read, if it fits
 * the Input contract.
 */
export function parseFlowFile(text: string, entries: readonly { inputs: NodeInput[]; outputs: NodeOutput[] }[]): ParseResult {
  if (text.length > FLOW_FILE_MAX_BYTES) return fail("That file is too large to be a Flow file.");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail("That file is not valid JSON, so it is not a Flow file.");
  }
  if (!isObject(raw) || raw.format !== FLOW_FILE_FORMAT) return fail("That is not a Clauderon Flow file.");
  if (raw.version !== FLOW_FILE_VERSION) return fail(`This Flow file has version ${String(raw.version)}; this app reads version ${FLOW_FILE_VERSION}.`);

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return fail("The Flow has no name.");
  if (name.length > 120) return fail("The Flow name is at most 120 characters.");
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.placements) || !Array.isArray(raw.edges)) return fail("The file must hold nodes, placements and edges as lists.");
  if (raw.nodes.length > MAX_NODES || raw.placements.length > MAX_PLACEMENTS || raw.edges.length > MAX_EDGES) return fail("The Flow is too large to import.");

  const nodes: ParsedFlow["nodes"] = [];
  const refs = new Set<string>();
  for (const [i, n] of raw.nodes.entries()) {
    if (!isObject(n) || typeof n.ref !== "string" || !n.ref) return fail(`Node ${i + 1} has no ref.`);
    if (refs.has(n.ref)) return fail(`Node ref "${n.ref}" appears twice.`);
    refs.add(n.ref);
    if (ENTRY_KINDS.has(n.kind)) {
      const declared = n.kind === "ticket" ? "issue" : Array.isArray(n.outputs) ? (n.outputs[0] as { type?: unknown } | undefined)?.type : undefined;
      const known = entries.find((e) => e.outputs[0]?.type === declared);
      if (known) {
        nodes.push({ ref: n.ref, isEntry: true, definition: { name: String(n.name ?? "Input"), kind: "input", instructions: "", command: null, inputs: known.inputs, outputs: known.outputs } });
        continue;
      }
      // No such Input Node here yet: it comes from the file, once its ports fit the Input contract.
      const checked = checkNodeDefinition({ ...n, kind: "agent", instructions: "Input", command: null });
      if (!checked.ok) return fail(`Node "${String(n.name ?? n.ref)}": ${checked.error}`);
      const d = checked.definition;
      const only = d.outputs[0];
      if (d.inputs.length > 0 || d.outputs.length !== 1 || !only || only.optional || !(INPUT_TYPES as readonly string[]).includes(only.type)) {
        return fail(`Node "${d.name}": an Input Node has no inputs and one required Output of type ${INPUT_TYPES.join(", ")}.`);
      }
      const instructions = typeof n.instructions === "string" ? n.instructions.trim().slice(0, 20_000) : "";
      nodes.push({ ref: n.ref, isEntry: true, definition: { name: d.name, kind: "input", instructions, command: null, inputs: [], outputs: d.outputs } });
      continue;
    }
    const checked = checkNodeDefinition(n);
    if (!checked.ok) return fail(`Node "${String(n.name ?? n.ref)}": ${checked.error}`);
    nodes.push({ ref: n.ref, isEntry: false, definition: checked.definition });
  }

  const placements: ParsedFlow["placements"] = [];
  const placementIds = new Set<string>();
  for (const [i, p] of raw.placements.entries()) {
    if (!isObject(p) || typeof p.id !== "string" || !p.id) return fail(`Placement ${i + 1} has no id.`);
    if (placementIds.has(p.id)) return fail(`Placement id "${p.id}" appears twice.`);
    placementIds.add(p.id);
    if (typeof p.node !== "string" || !refs.has(p.node)) return fail(`Placement "${p.id}" uses a Node that is not in the file.`);
    if (typeof p.x !== "number" || typeof p.y !== "number" || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return fail(`Placement "${p.id}" has no position.`);
    const label = p.label == null ? null : String(p.label).slice(0, 120);
    const extra = String(p.extraInstructions ?? "").slice(0, 20_000);
    const optional = Array.isArray(p.enabledOptionalOutputs) ? p.enabledOptionalOutputs.map(String) : [];
    placements.push({ id: p.id, node: p.node, label, extraInstructions: extra, enabledOptionalOutputs: optional, x: p.x, y: p.y });
  }

  const edges: ParsedFlow["edges"] = [];
  for (const [i, e] of raw.edges.entries()) {
    if (!isObject(e) || typeof e.from !== "string" || typeof e.to !== "string" || typeof e.output !== "string" || typeof e.input !== "string") return fail(`Edge ${i + 1} is incomplete.`);
    if (!placementIds.has(e.from) || !placementIds.has(e.to)) return fail(`Edge ${i + 1} joins a Node that is not placed in the Flow.`);
    edges.push({ from: e.from, output: e.output, to: e.to, input: e.input });
  }

  const problems = validateFlow(
    {
      nodes: placements.map((p) => ({ id: p.id, nodeId: p.node, x: p.x, y: p.y, enabledOptionalOutputs: p.enabledOptionalOutputs })),
      edges: edges.map((e, i) => ({ id: `e${i + 1}`, fromFlowNodeId: e.from, fromOutput: e.output, toFlowNodeId: e.to, toInput: e.input })),
    },
    nodes.map((n) => ({ id: n.ref, name: n.definition.name, kind: n.definition.kind, inputs: n.definition.inputs, outputs: n.definition.outputs })),
  );
  const fatal = problems.find((p) => FATAL.has(p.code));
  if (fatal) return fail(`The Flow in this file is not valid: ${fatal.message}.`);

  return { ok: true, flow: { name, nodes, placements, edges } };
}
