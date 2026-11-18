import { checkNodeDefinition, type NodeInput, type NodeKind, type NodeOutput, type OutputType } from "@clauderon/core";

// What the Node library page shows and decides, apart from React: filtering the
// list, the help texts, and why Save or Delete is unavailable. Pure, so it is
// unit-tested.

export type LibraryUse = { flowId: string; name: string; locked: boolean };

/** One library Node as the page needs it (serialisable: it crosses from the server page to the client list). */
export type LibraryNodeView = {
  id: string;
  name: string;
  kind: NodeKind;
  instructions: string;
  command: string | null;
  inputs: NodeInput[];
  outputs: NodeOutput[];
  isSample: boolean;
  usedBy: LibraryUse[];
};

export type NodeFormValue = {
  id: string | null;
  name: string;
  kind: NodeKind;
  instructions: string;
  command: string | null;
  inputs: NodeInput[];
  outputs: NodeOutput[];
};

export const KIND_HELP: Record<NodeKind, string> = {
  agent: "Claude works on the instructions by itself and reports its Outputs.",
  command: "Runs a shell command in the Pod. The exit code and the end of its output become the Output.",
  approve: "Pauses the Run until a person approves, or rejects with feedback for the next try.",
  grill: "Claude asks a person its questions first, then produces its Outputs.",
  ticket: "The entry of every Flow (built in).",
};

export const TYPE_HELP: Record<OutputType, string> = {
  issue: "A GitHub issue: number, title and body.",
  plan: "A short step-by-step plan.",
  branch: "A branch committed in the Pod's clone.",
  "test-result": "The exit code and the last lines of a test run.",
  "pull-request": "A GitHub pull request.",
  summary: "Free text, such as a summary or a link.",
  screenshot: "Screenshots of the pages a change touches.",
};

export const INSTRUCTIONS_MAX = 20_000;

/** Nodes whose name, instructions or command contain the query, of the chosen Kind ("all" for every Kind). */
export function filterNodes<T extends Pick<LibraryNodeView, "name" | "kind" | "instructions" | "command">>(nodes: readonly T[], query: string, kind: NodeKind | "all"): T[] {
  const q = query.trim().toLowerCase();
  return nodes.filter((n) => (kind === "all" || n.kind === kind) && (!q || `${n.name}\n${n.instructions}\n${n.command ?? ""}`.toLowerCase().includes(q)));
}

/** How many Nodes each Kind has, for the filter chips; only Kinds that have any. */
export function kindCounts(nodes: readonly Pick<LibraryNodeView, "kind">[]): { kind: NodeKind; count: number }[] {
  const counts = new Map<NodeKind, number>();
  for (const n of nodes) counts.set(n.kind, (counts.get(n.kind) ?? 0) + 1);
  return [...counts].map(([kind, count]) => ({ kind, count }));
}

/** Why Save is not available yet (the same rules the server applies), or null when the form can be saved. */
export function saveBlocker(value: NodeFormValue): string | null {
  const checked = checkNodeDefinition({ ...value, command: value.kind === "command" ? (value.command ?? "") : null });
  return checked.ok ? null : checked.error;
}

/** Why a Node cannot be deleted (a Flow still places it), or null. The server refuses it too. */
export function deleteBlocker(usedBy: readonly LibraryUse[]): string | null {
  if (usedBy.length === 0) return null;
  return `Used by ${usedBy.map((u) => u.name).join(", ")}. Take it out of ${usedBy.length === 1 ? "that Flow" : "those Flows"} first.`;
}

export const sameValue = (a: NodeFormValue, b: NodeFormValue) => JSON.stringify(a) === JSON.stringify(b);
