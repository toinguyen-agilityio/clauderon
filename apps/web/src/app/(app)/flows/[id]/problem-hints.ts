// Turns the validator's Problems (core's validateFlow) into what the editor shows: a
// plain title naming the Nodes and ports involved, a hint on how to fix it, and, when
// one click can fix it, that fix. Pure, so it is unit-tested.

import { isEntryKind } from "@clauderon/core";
import type { FlowEdge, LibraryNode, Problem } from "@clauderon/core";

export type ProblemFix =
  | { kind: "remove-edge"; edgeId: string; label: string }
  | { kind: "remove-node"; flowNodeId: string; label: string }
  | { kind: "enable-output"; flowNodeId: string; output: string; label: string }
  | { kind: "add-node"; label: string };

export type ProblemView = {
  problem: Problem;
  title: string;
  hint: string;
  fix?: ProblemFix;
  /** The Nodes to highlight on the canvas. */
  nodeIds: string[];
  /** For a problem on an edge: which end names a port the Node does not have. */
  missing?: { from?: string; to?: string };
};

type Placement = { id: string; nodeId: string; label: string | null };

export function describeProblems(problems: readonly Problem[], placements: readonly Placement[], edges: readonly FlowEdge[], library: readonly LibraryNode[]): ProblemView[] {
  const byPlacement = new Map(placements.map((p) => [p.id, p]));
  const libById = new Map(library.map((n) => [n.id, n]));
  const libOf = (id: string) => libById.get(byPlacement.get(id)?.nodeId ?? "");
  const nameOf = (id: string) => {
    const p = byPlacement.get(id);
    return `“${p?.label || libOf(id)?.name || "a removed Node"}”`;
  };
  const edgeById = new Map(edges.map((e) => [e.id, e]));

  return problems.map((problem): ProblemView => {
    const edge = problem.edgeId ? edgeById.get(problem.edgeId) : undefined;
    const ends = edge ? [edge.fromFlowNodeId, edge.toFlowNodeId] : [];
    const from = edge ? nameOf(edge.fromFlowNodeId) : "";
    const to = edge ? nameOf(edge.toFlowNodeId) : "";
    const removeEdge = edge ? ({ kind: "remove-edge", edgeId: edge.id, label: "Remove this edge" } as const) : undefined;

    switch (problem.code) {
      case "unknown-port": {
        if (!edge) return { problem, title: "An edge names a port that does not exist", hint: "Remove it and draw it again.", nodeIds: [] };
        const fromLib = libOf(edge.fromFlowNodeId);
        const toLib = libOf(edge.toFlowNodeId);
        const noOutput = !fromLib?.outputs.some((o) => o.name === edge.fromOutput);
        const noInput = !toLib?.inputs.some((i) => i.name === edge.toInput);
        const parts = [noOutput ? `${from} has no Output “${edge.fromOutput}”` : "", noInput ? `${to} has no input “${edge.toInput}”` : ""].filter(Boolean);
        return {
          problem,
          title: `Broken edge ${from} → ${to}`,
          hint: `${parts.join(", and ")}. The Node changed in the library after this edge was drawn. Remove the edge, then connect the right ports again.`,
          fix: removeEdge,
          nodeIds: ends,
          missing: { from: noOutput ? edge.fromOutput : undefined, to: noInput ? edge.toInput : undefined },
        };
      }
      case "type-mismatch": {
        const out = edge && libOf(edge.fromFlowNodeId)?.outputs.find((o) => o.name === edge.fromOutput);
        const inp = edge && libOf(edge.toFlowNodeId)?.inputs.find((i) => i.name === edge.toInput);
        return {
          problem,
          title: `Types do not match: ${from} → ${to}`,
          hint: out && inp ? `“${out.name}” makes a ${out.type}, but “${inp.name}” takes a ${inp.type}. Connect “${inp.name}” to an Output of type ${inp.type}.` : problem.message,
          fix: removeEdge,
          nodeIds: ends,
        };
      }
      case "input-taken":
        return {
          problem,
          title: `Two edges into input “${edge?.toInput}” of ${to}`,
          hint: "An input takes one edge. Remove the one you do not want.",
          fix: removeEdge,
          nodeIds: ends,
        };
      case "optional-output-off":
        return {
          problem,
          title: `Output “${edge?.fromOutput}” of ${from} is switched off`,
          hint: "This optional Output is not made, so the edge from it carries nothing. Switch it on, or remove the edge.",
          fix: edge ? { kind: "enable-output", flowNodeId: edge.fromFlowNodeId, output: edge.fromOutput, label: `Switch “${edge.fromOutput}” on` } : removeEdge,
          nodeIds: ends,
        };
      case "cycle":
        return {
          problem,
          title: `Edge ${from} → ${to} makes a loop`,
          hint: "A Flow runs one way, with no loops. Remove this edge; a person retries a failed Run instead.",
          fix: removeEdge,
          nodeIds: ends,
        };
      case "required-input-unconnected": {
        const node = problem.flowNodeId ?? "";
        const inp = libOf(node)?.inputs.find((i) => i.name === problem.input);
        return {
          problem,
          title: `${nameOf(node)} is missing its “${problem.input}” input`,
          hint: `Drag from an Output of type ${inp?.type ?? "the same type"} to the highlighted “${problem.input}” port.`,
          nodeIds: [node],
        };
      }
      case "unknown-node":
        return {
          problem,
          title: "A Node is no longer in the library",
          hint: "It was removed from the library after it was placed here. Remove it and pick another Node.",
          fix: problem.flowNodeId ? { kind: "remove-node", flowNodeId: problem.flowNodeId, label: "Remove this Node" } : undefined,
          nodeIds: problem.flowNodeId ? [problem.flowNodeId] : [],
        };
      case "entry-count": {
        const entries = placements.filter((p) => {
          const kind = libOf(p.id)?.kind;
          return kind !== undefined && isEntryKind(kind);
        }).map((p) => p.id);
        return entries.length === 0
          ? { problem, title: "The Flow has no Input Node", hint: "Every Flow starts from exactly one Input. Add an Input Node, such as Ticket or Branch, and connect it to the first step.", fix: { kind: "add-node", label: "Add a Node" }, nodeIds: [] }
          : { problem, title: `The Flow has ${entries.length} Input Nodes`, hint: "A Flow starts from exactly one Input. Remove the extra ones.", nodeIds: entries };
      }
      case "input-group-unconnected":
        return { problem, title: "A Node has nothing to work from", hint: `${problem.message}. Connect one of them.`, nodeIds: problem.flowNodeId ? [problem.flowNodeId] : [] };
      case "no-end-node":
        return { problem, title: "The Flow never ends", hint: "At least one Node needs no edge going out of it. Remove an edge that leads back, or add a final step.", nodeIds: [] };
    }
  });
}
