import { mask } from "./mask";
import { checkNodeDefinition, type NodeDefinition } from "./library";

// Exporting library Nodes to a file and importing them (issue #116). Same idea as the Flow file:
// definitions only, no ids, emails, dates or tokens.

export const NODE_FILE_FORMAT = "clauderon-nodes";
export const NODE_FILE_VERSION = 1;
export const NODE_FILE_MAX_BYTES = 1_000_000;
const MAX_NODES = 100;

export type NodeFile = {
  format: typeof NODE_FILE_FORMAT;
  version: typeof NODE_FILE_VERSION;
  nodes: NodeDefinition[];
};

/** The file for one or more Nodes. Known token patterns are masked out of the free text (NFR-1). */
export function buildNodeFile(definitions: readonly NodeDefinition[]): NodeFile {
  return {
    format: NODE_FILE_FORMAT,
    version: NODE_FILE_VERSION,
    nodes: definitions.map((d) => ({
      name: d.name,
      kind: d.kind,
      instructions: mask(d.instructions),
      command: d.command === null ? null : mask(d.command),
      inputs: d.inputs,
      outputs: d.outputs,
    })),
  };
}

export type ParsedNodes = {
  /** Nodes that pass the New Node checks, in file order. */
  definitions: NodeDefinition[];
  /** Names of Ticket entries: a Member cannot make a Ticket Node, so they are not created. */
  tickets: string[];
};
export type ParseNodesResult = { ok: true; parsed: ParsedNodes } | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const fail = (error: string): ParseNodesResult => ({ ok: false, error });

/** Reads a Node file with the rules of New Node; one bad Node fails the whole file. */
export function parseNodeFile(text: string): ParseNodesResult {
  if (text.length > NODE_FILE_MAX_BYTES) return fail("That file is too large to be a Node file.");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail("That file is not valid JSON, so it is not a Node file.");
  }
  if (!isObject(raw) || raw.format !== NODE_FILE_FORMAT) return fail("That is not a Clauderon Node file.");
  if (raw.version !== NODE_FILE_VERSION) return fail(`This Node file has version ${String(raw.version)}; this app reads version ${NODE_FILE_VERSION}.`);
  if (!Array.isArray(raw.nodes)) return fail("The file must hold nodes as a list.");
  if (raw.nodes.length === 0) return fail("The file holds no Nodes.");
  if (raw.nodes.length > MAX_NODES) return fail(`A Node file holds at most ${MAX_NODES} Nodes.`);

  const definitions: NodeDefinition[] = [];
  const tickets: string[] = [];
  for (const [i, n] of raw.nodes.entries()) {
    if (!isObject(n)) return fail(`Node ${i + 1} is not a Node definition.`);
    const label = String(n.name ?? "").trim() || `#${i + 1}`;
    if (n.kind === "ticket") {
      tickets.push(label);
      continue;
    }
    const checked = checkNodeDefinition(n);
    if (!checked.ok) return fail(`Node "${label}": ${checked.error}`);
    definitions.push(checked.definition);
  }
  return { ok: true, parsed: { definitions, tickets } };
}
