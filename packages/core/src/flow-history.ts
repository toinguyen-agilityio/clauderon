import type { FlowEdge } from "./flow";
import type { NodeDefinition } from "./library";
import { mask } from "./mask";

// Flow history (issue #181): what a version of a Flow holds, what changed between two
// versions, and that change in plain words. Pure: the database module stores the result.

export const FLOW_VERSION_KINDS = ["create", "clone", "import", "update", "restore", "library-node", "delete", "baseline"] as const;
export type FlowVersionKind = (typeof FLOW_VERSION_KINDS)[number];

/** One placement with its library Node's definition inlined, so a version stands alone. */
export type VersionNode = {
  id: string;
  nodeId: string;
  label: string | null;
  definition: NodeDefinition;
  extraInstructions: string;
  enabledOptionalOutputs: string[];
  x: number;
  y: number;
};

/** A Flow as it was at one version: name, placements and edges. */
export type VersionSnapshot = { name: string; nodes: VersionNode[]; edges: FlowEdge[] };

export type FlowChange =
  | { type: "baseline" }
  | { type: "unknown" }
  | { type: "flow-renamed"; from: string; to: string }
  | { type: "node-added"; node: string }
  | { type: "node-removed"; node: string }
  | { type: "node-renamed"; from: string; to: string }
  | { type: "instructions-edited"; node: string }
  | { type: "extra-instructions-edited"; node: string }
  | { type: "ports-changed"; node: string }
  | { type: "optional-outputs-changed"; node: string }
  | { type: "edge-added"; from: string; to: string }
  | { type: "edge-removed"; from: string; to: string }
  | { type: "edge-rewired"; from: string; to: string; fromBefore: string; toBefore: string }
  | { type: "layout-changed" }
  | { type: "library-node-changed"; node: string; what: string[] };

export const nodeName = (n: VersionNode): string => n.label ?? n.definition.name;

/** Hides known token patterns in every free-text field of a snapshot (NFR-1). */
export function maskSnapshot(snapshot: VersionSnapshot): VersionSnapshot {
  return {
    ...snapshot,
    nodes: snapshot.nodes.map((n) => ({
      ...n,
      definition: { ...n.definition, instructions: mask(n.definition.instructions), command: n.definition.command === null ? null : mask(n.definition.command) },
      extraInstructions: mask(n.extraInstructions),
    })),
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The typed changes from `before` to `after`; empty when nothing but nothing changed. A null `before` is the first version. */
export function diffFlow(before: VersionSnapshot | null, after: VersionSnapshot): FlowChange[] {
  if (!before) return [{ type: "baseline" }];
  const changes: FlowChange[] = [];
  if (before.name !== after.name) changes.push({ type: "flow-renamed", from: before.name, to: after.name });

  const was = new Map(before.nodes.map((n) => [n.id, n]));
  const now = new Map(after.nodes.map((n) => [n.id, n]));
  let moved = false;
  for (const n of after.nodes) {
    const old = was.get(n.id);
    // A placement of another library Node is a different Node, not an edit.
    if (!old || old.nodeId !== n.nodeId) {
      changes.push({ type: "node-added", node: nodeName(n) });
      continue;
    }
    const name = nodeName(n);
    if (nodeName(old) !== name) changes.push({ type: "node-renamed", from: nodeName(old), to: name });
    if (old.definition.instructions !== n.definition.instructions || old.definition.command !== n.definition.command) changes.push({ type: "instructions-edited", node: name });
    if (old.extraInstructions !== n.extraInstructions) changes.push({ type: "extra-instructions-edited", node: name });
    if (!same(old.definition.inputs, n.definition.inputs) || !same(old.definition.outputs, n.definition.outputs)) changes.push({ type: "ports-changed", node: name });
    if (!same([...old.enabledOptionalOutputs].sort(), [...n.enabledOptionalOutputs].sort())) changes.push({ type: "optional-outputs-changed", node: name });
    if (old.x !== n.x || old.y !== n.y) moved = true;
  }
  for (const o of before.nodes) {
    const n = now.get(o.id);
    if (!n || n.nodeId !== o.nodeId) changes.push({ type: "node-removed", node: nodeName(o) });
  }

  // Edges are the same edge when they join the same ports; what is left over is paired by id (rewired).
  const label = (snapshot: VersionSnapshot, id: string) => {
    const n = snapshot.nodes.find((x) => x.id === id);
    return n ? `${nodeName(n)}` : "?";
  };
  const key = (e: FlowEdge) => `${e.fromFlowNodeId}\0${e.fromOutput}\0${e.toFlowNodeId}\0${e.toInput}`;
  const keptKeys = new Set(before.edges.map(key));
  const nowKeys = new Set(after.edges.map(key));
  const removed = before.edges.filter((e) => !nowKeys.has(key(e)));
  const added = after.edges.filter((e) => !keptKeys.has(key(e)));
  for (const e of added) {
    const old = removed.find((r) => r.id === e.id);
    if (old) {
      removed.splice(removed.indexOf(old), 1);
      changes.push({ type: "edge-rewired", from: label(after, e.fromFlowNodeId), to: label(after, e.toFlowNodeId), fromBefore: label(before, old.fromFlowNodeId), toBefore: label(before, old.toFlowNodeId) });
    } else changes.push({ type: "edge-added", from: label(after, e.fromFlowNodeId), to: label(after, e.toFlowNodeId) });
  }
  for (const e of removed) changes.push({ type: "edge-removed", from: label(before, e.fromFlowNodeId), to: label(before, e.toFlowNodeId) });

  if (changes.length === 0 && moved) changes.push({ type: "layout-changed" });
  return changes;
}

const NODE_LEVEL = new Set<FlowChange["type"]>(["node-renamed", "instructions-edited", "ports-changed"]);
const WHAT: Partial<Record<FlowChange["type"], string>> = { "node-renamed": "renamed", "instructions-edited": "instructions edited", "ports-changed": "inputs or outputs changed" };

/** For a change made in the library: groups the per-Node changes into one entry per Node. */
export function libraryChanges(changes: readonly FlowChange[]): FlowChange[] {
  const byNode = new Map<string, string[]>();
  const rest: FlowChange[] = [];
  for (const c of changes) {
    if (!NODE_LEVEL.has(c.type)) {
      rest.push(c);
      continue;
    }
    const name = c.type === "node-renamed" ? c.from : (c as { node: string }).node;
    byNode.set(name, [...(byNode.get(name) ?? []), WHAT[c.type]!]);
  }
  return [...[...byNode].map(([node, what]) => ({ type: "library-node-changed", node, what }) as FlowChange), ...rest];
}

/** One change in plain words, e.g. `Node "Implement" added`. Masked, since Node names are free text. */
export function describeChange(change: FlowChange): string {
  const text = ((): string => {
    switch (change.type) {
      case "baseline":
        return "Existing before history";
      case "unknown":
        return "Changed (the earlier version was not recorded)";
      case "flow-renamed":
        return `Flow renamed from "${change.from}" to "${change.to}"`;
      case "node-added":
        return `Node "${change.node}" added`;
      case "node-removed":
        return `Node "${change.node}" removed`;
      case "node-renamed":
        return `Node "${change.from}" renamed to "${change.to}"`;
      case "instructions-edited":
        return `instructions of "${change.node}" edited`;
      case "extra-instructions-edited":
        return `extra instructions of "${change.node}" edited`;
      case "ports-changed":
        return `inputs or outputs of "${change.node}" changed`;
      case "optional-outputs-changed":
        return `optional outputs of "${change.node}" changed`;
      case "edge-added":
        return `edge from "${change.from}" to "${change.to}" added`;
      case "edge-removed":
        return `edge from "${change.from}" to "${change.to}" removed`;
      case "edge-rewired":
        return `edge from "${change.fromBefore}" to "${change.toBefore}" rewired to "${change.from}" to "${change.to}"`;
      case "layout-changed":
        return "Layout changed";
      case "library-node-changed":
        return `Node "${change.node}" changed in the library (${change.what.join(", ")})`;
    }
  })();
  const masked = mask(text);
  return masked.charAt(0).toUpperCase() + masked.slice(1);
}

/** The whole summary as one list of sentences; "No changes" when empty. */
export function describeChanges(changes: readonly FlowChange[]): string[] {
  return changes.length === 0 ? ["No changes"] : changes.map(describeChange);
}
