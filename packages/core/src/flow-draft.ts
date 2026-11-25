import { OUTPUT_TYPES, isEntryKind, type NodeInput, type NodeOutput } from "./flow";
import { FLOW_FILE_FORMAT, FLOW_FILE_MAX_BYTES, FLOW_FILE_VERSION, parseFlowFile, type FlowFile, type ParsedFlow } from "./flow-file";
import type { NodeDefinition } from "./library";
import { extractResultBlock } from "./runner";
import { agentAtLeast } from "./run-attachment";

// Flow Drafts (ADR 0008): Claude Code on the Member's own Machine writes a Flow file from a
// description; the Member previews it and creates it through the ordinary import. Pure: the
// Gateway builds the prompts and reads the answers with these.

/** How long one Claude Code call of a Flow Draft may take before the Gateway gives up. */
export const FLOW_DRAFT_TIMEOUT_MS = 180_000;
/** The first Agent version that understands `flow.draft`. */
export const FLOW_DRAFT_MIN_AGENT = "0.5.0";
export const FLOW_DRAFT_MAX_DESCRIPTION = 4_000;

/** Whether an Agent reporting `version` (e.g. `0.5.0+abc`, `0.5.0-dev`) can write Flow Drafts. */
export function agentSupportsFlowDrafts(version: string | null | undefined): boolean {
  return agentAtLeast(version, FLOW_DRAFT_MIN_AGENT);
}

/** A library Node as the prompt shows it and as a draft may reuse it. */
export type DraftLibraryNode = NodeDefinition;

const port = (p: NodeInput | NodeOutput) =>
  "required" in p ? `${p.name}: ${p.type}${p.required ? "" : " (optional)"}` : `${p.name}: ${p.type}${p.optional ? " (optional)" : ""}`;

function describeLibrary(library: readonly DraftLibraryNode[]): string {
  return library
    .map((n) => {
      const lines = [`- "${n.name}" (${n.kind})`];
      lines.push(`  inputs: ${n.inputs.map(port).join(", ") || "none"}`);
      lines.push(`  outputs: ${n.outputs.map(port).join(", ") || "none"}`);
      const what = n.kind === "command" ? n.command : n.instructions;
      if (what) lines.push(`  does: ${what.replace(/\s+/g, " ").slice(0, 300)}`);
      return lines.join("\n");
    })
    .join("\n");
}

const FORMAT_RULES = `Answer with one fenced \`\`\`json block holding the Flow file, and nothing after it:

{
  "format": "${FLOW_FILE_FORMAT}",
  "version": ${FLOW_FILE_VERSION},
  "name": "<Flow name>",
  "nodes": [
    { "ref": "n1", "use": "<exact name of a library Node>" },
    { "ref": "n2", "name": "<new Node name>", "kind": "agent" | "command" | "approve" | "grill",
      "instructions": "<prompt of an Agent Node, guidance of a Human Node>", "command": "<bash, Command Nodes only, else null>",
      "inputs": [{ "name": "<lower-case-name>", "type": "<Output Type>", "required": true }],
      "outputs": [{ "name": "<lower-case-name>", "type": "<Output Type>", "optional": false }] }
  ],
  "placements": [{ "id": "p1", "node": "n1", "label": null, "extraInstructions": "", "enabledOptionalOutputs": [], "x": 0, "y": 0 }],
  "edges": [{ "from": "p1", "output": "<output name of p1's Node>", "to": "p2", "input": "<input name of p2's Node>" }]
}

Rules:
- Exactly one placement of a library Node of kind "input": it is the entry and emits what the Member supplies when starting a Run. Use "Ticket" when the work starts from a GitHub issue.
- Prefer library Nodes ("use" with the exact name). Define a new Node only when no library Node fits.
- Output Types: ${OUTPUT_TYPES.join(", ")}. An edge joins an output to an input of the same type; each input takes at most one edge; every required input needs one.
- No cycles: a Flow is a directed acyclic graph. A failed Node fails the Run; nothing loops back.
- Agent Nodes run Claude Code in the Run's worktree; Command Nodes run bash there (exit 0 is success); approve pauses for a Member to approve or reject; grill asks the Member questions.
- Use "label" and "extraInstructions" on a placement to tailor a library Node to this Flow.
- Positions do not matter; they are laid out again.`;

/** The first prompt of a Flow Draft, or a fresh one that carries an earlier draft and a note. */
export function flowDraftPrompt(input: { description: string; library: readonly DraftLibraryNode[]; previous?: string; note?: string }): string {
  const parts = [
    "You design a Flow for Clauderon: a directed acyclic graph of Nodes that a Run takes its input (usually a GitHub issue, a Ticket) through, each Node running on the Member's computer.",
    "Do not use tools or touch files: answer from this message alone.",
    `What the Member wants:\n<description>\n${input.description.trim()}\n</description>`,
    `The Node library:\n${describeLibrary(input.library)}`,
    FORMAT_RULES,
  ];
  if (input.previous) parts.push(`Your earlier draft:\n\`\`\`json\n${input.previous}\n\`\`\``);
  if (input.note) parts.push(`Change the earlier draft as the Member asks:\n<note>\n${input.note.trim()}\n</note>\nAnswer with the whole changed Flow file.`);
  return parts.join("\n\n");
}

/** A follow-up in the same Claude session: the Member's note on the last draft. */
export function flowDraftRevisePrompt(note: string): string {
  return `Change the Flow as the Member asks, keeping the same rules and format:\n<note>\n${note.trim()}\n</note>\nAnswer with the whole changed Flow file in one fenced \`\`\`json block.`;
}

/** A follow-up in the same Claude session when its answer was not a valid Flow file. */
export function flowDraftRepairPrompt(error: string): string {
  return `That answer is not a valid Flow file: ${error}\nFix it and answer again with the whole Flow file in one fenced \`\`\`json block.`;
}

export type FlowDraftRead = { ok: true; file: FlowFile; newNodes: string[] } | { ok: false; error: string };

const sameDefinition = (a: NodeDefinition, b: NodeDefinition) =>
  a.name === b.name && a.kind === b.kind && a.instructions === b.instructions && a.command === b.command && JSON.stringify(a.inputs) === JSON.stringify(b.inputs) && JSON.stringify(a.outputs) === JSON.stringify(b.outputs);

/**
 * Reads Claude's final message: the Flow file in its last JSON block, with each `use` of a
 * library Node replaced by that Node's exact definition (so the import reuses it), checked as an
 * import would check it. Returns the file in its plain form and the names of the new Nodes.
 */
export function readFlowDraft(finalText: string, library: readonly DraftLibraryNode[]): FlowDraftRead {
  const raw = extractResultBlock(finalText);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "the answer holds no JSON object." };
  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.nodes)) return { ok: false, error: "the file has no nodes list." };

  const byName = new Map(library.map((n) => [n.name.toLowerCase(), n]));
  const nodes: unknown[] = [];
  for (const n of value.nodes) {
    if (n && typeof n === "object" && typeof (n as { use?: unknown }).use === "string") {
      const { use, ref } = n as { use: string; ref?: unknown };
      const lib = byName.get(use.trim().toLowerCase());
      if (!lib) return { ok: false, error: `there is no library Node named "${use}"; use an exact name from the list, or define a new Node.` };
      nodes.push({ ref, ...lib });
    } else {
      nodes.push(n);
    }
  }
  const text = JSON.stringify({ ...value, nodes });
  if (text.length > FLOW_FILE_MAX_BYTES) return { ok: false, error: "the Flow file is too large." };

  const parsed = parseFlowFile(text, library.filter((n) => isEntryKind(n.kind)));
  if (!parsed.ok) return { ok: false, error: parsed.error };
  if (parsed.flow.placements.filter((p) => parsed.flow.nodes.find((n) => n.ref === p.node)?.isEntry).length !== 1) {
    return { ok: false, error: "the Flow needs exactly one placement of an Input Node." };
  }

  const newNodes = parsed.flow.nodes.filter((n) => !n.isEntry && !library.some((l) => sameDefinition(l, n.definition))).map((n) => n.definition.name);
  return { ok: true, file: flowFileOf(parsed.flow), newNodes };
}

/** A checked Flow back in file form. */
export function flowFileOf(flow: ParsedFlow): FlowFile {
  return {
    format: FLOW_FILE_FORMAT,
    version: FLOW_FILE_VERSION,
    name: flow.name,
    nodes: flow.nodes.map((n) => ({ ref: n.ref, ...n.definition })),
    placements: flow.placements,
    edges: flow.edges,
  };
}
