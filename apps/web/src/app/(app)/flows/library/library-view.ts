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
  command: "Runs a bash command on the Starter's Machine. The exit code and the end of its output become the Output.",
  approve: "Pauses the Run until a person approves, or rejects with feedback for the next try.",
  grill: "Claude asks a person its questions first, then produces its Outputs.",
  ticket: "The entry of every Flow (built in).",
};

export const TYPE_HELP: Record<OutputType, string> = {
  issue: "A GitHub issue: number, title and body.",
  plan: "A short step-by-step plan.",
  branch: "A branch committed in the Run's worktree.",
  "test-result": "The exit code and the last lines of a test run.",
  "pull-request": "A GitHub pull request.",
  summary: "Free text, such as a summary or a link.",
  screenshot: "Screenshots of the pages a change touches.",
};

export const INSTRUCTIONS_MAX = 20_000;

/** The filter groups of the library: approve and grill both wait on a person. */
export type KindGroup = "agent" | "command" | "human" | "ticket";
export const KIND_GROUPS: readonly KindGroup[] = ["agent", "command", "human", "ticket"];
export const KIND_GROUP_LABEL: Record<KindGroup, string> = { agent: "Agent", command: "Command", human: "Human", ticket: "Ticket" };

export function kindGroupOf(kind: NodeKind): KindGroup {
  return kind === "approve" || kind === "grill" ? "human" : kind;
}

type Searchable = Pick<LibraryNodeView, "name" | "kind" | "instructions" | "command"> & { inputs?: readonly NodeInput[]; outputs?: readonly NodeOutput[] };

/**
 * Nodes whose name, instructions, command or port names and Output Types contain the
 * query, in the chosen Kind group ("all" for every group).
 */
export function filterNodes<T extends Searchable>(nodes: readonly T[], query: string, group: KindGroup | "all"): T[] {
  const q = query.trim().toLowerCase();
  return nodes.filter((n) => {
    if (group !== "all" && kindGroupOf(n.kind) !== group) return false;
    if (!q) return true;
    const ports = [...(n.inputs ?? []), ...(n.outputs ?? [])].map((p) => `${p.name} ${p.type}`).join("\n");
    return `${n.name}\n${n.instructions}\n${n.command ?? ""}\n${ports}`.toLowerCase().includes(q);
  });
}

/** How many Nodes each Kind group has, for the filter; only groups that have any, in a fixed order. */
export function groupCounts(nodes: readonly Pick<LibraryNodeView, "kind">[]): { group: KindGroup; count: number }[] {
  const counts = new Map<KindGroup, number>();
  for (const n of nodes) counts.set(kindGroupOf(n.kind), (counts.get(kindGroupOf(n.kind)) ?? 0) + 1);
  return KIND_GROUPS.filter((g) => counts.has(g)).map((group) => ({ group, count: counts.get(group)! }));
}

/** The footer of a library card, e.g. "Human · Grill · in 2 Flows" or "Agent · in no Flow". */
export function cardMeta(node: Pick<LibraryNodeView, "kind" | "usedBy">): string {
  const group = kindGroupOf(node.kind);
  const kind = group === "human" ? `${KIND_GROUP_LABEL.human} · ${node.kind[0]!.toUpperCase()}${node.kind.slice(1)}` : KIND_GROUP_LABEL[group];
  const n = node.usedBy.length;
  return `${kind} · ${n === 0 ? "in no Flow" : `in ${n} Flow${n === 1 ? "" : "s"}`}`;
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

export type SaveResult = { ok: true; flows: number; withProblems: number } | { ok: false; error: string };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** What the form does after a save: a created Node closes the dialog, a failure keeps it open with the error. */
export function saveOutcome(
  result: SaveResult,
  isNew: boolean,
): { close: boolean; message: { kind: "ok" | "error"; text: string } } {
  if (!result.ok) return { close: false, message: { kind: "error", text: result.error } };
  if (isNew) return { close: true, message: { kind: "ok", text: "Created." } };
  const problems = result.withProblems > 0 ? `; ${result.withProblems} now ${result.withProblems === 1 ? "has" : "have"} problems` : "";
  return { close: false, message: { kind: "ok", text: `Saved. It changed ${plural(result.flows, "Flow")}${problems}.` } };
}

/** A name for a copy that does not clash with an existing Node: "Copy of X", then "Copy of X (2)", "(3)"... (names are at most 120 characters). */
export function copyName(name: string, existing: readonly string[]): string {
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()));
  const fit = (base: string, suffix: string) => `${base.slice(0, 120 - suffix.length)}${suffix}`;
  const base = `Copy of ${name.trim()}`;
  let candidate = fit(base, "");
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = fit(base, ` (${n})`);
  return candidate;
}
