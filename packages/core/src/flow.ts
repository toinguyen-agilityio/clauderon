export const OUTPUT_TYPES = ["issue", "plan", "branch", "test-result", "pull-request", "summary", "screenshot"] as const;
export type OutputType = (typeof OUTPUT_TYPES)[number];

// `ticket` is the entry kind of Flows and Run snapshots from before Input Nodes.
export const NODE_KINDS = ["ticket", "input", "agent", "command", "approve", "grill"] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

/** The Output Types a Member can supply when starting a Run; the others only come from a Node. */
export const INPUT_TYPES = ["issue", "branch", "pull-request", "plan", "summary"] as const satisfies readonly OutputType[];
export type InputType = (typeof INPUT_TYPES)[number];

/** Whether a Node of this kind is a Flow's entry. */
export const isEntryKind = (kind: NodeKind): boolean => kind === "input" || kind === "ticket";

/** `group`: optional inputs of which at least one must be connected. */
export type NodeInput = { name: string; type: OutputType; required: boolean; group?: string };
export type NodeOutput = { name: string; type: OutputType; optional: boolean };

/** A Node in the library (FLW-1): its signature is what Flows connect to. */
export type LibraryNode = {
  id: string;
  name: string;
  kind: NodeKind;
  inputs: NodeInput[];
  outputs: NodeOutput[];
};

/** A placement of a library Node in a Flow (FLW-6). */
export type FlowNode = {
  id: string;
  nodeId: string;
  x: number;
  y: number;
  enabledOptionalOutputs: string[];
};

export type FlowEdge = {
  id: string;
  fromFlowNodeId: string;
  fromOutput: string;
  toFlowNodeId: string;
  toInput: string;
};

export type Flow = { nodes: FlowNode[]; edges: FlowEdge[] };

export type ProblemCode =
  | "entry-count"
  | "no-end-node"
  | "cycle"
  | "type-mismatch"
  | "input-taken"
  | "required-input-unconnected"
  | "input-group-unconnected"
  | "optional-output-off"
  | "unknown-node"
  | "unknown-port";

export type Problem = {
  code: ProblemCode;
  message: string;
  flowNodeId?: string;
  edgeId?: string;
  input?: string;
};

export type ConnectResult = { ok: true } | { ok: false; reason: string };

/** The edge rule (FLW-4), shared by the validator and the editor while dragging. */
export function canConnect(fromOutput: NodeOutput, toInput: NodeInput): ConnectResult {
  if (fromOutput.type !== toInput.type) {
    return { ok: false, reason: `Output Type ${fromOutput.type} does not match input type ${toInput.type}` };
  }
  return { ok: true };
}

/** Every problem that keeps a Flow from starting Runs (FLW-4, FLW-5). */
export function validateFlow(flow: Flow, library: readonly LibraryNode[]): Problem[] {
  const problems: Problem[] = [];
  const byId = new Map(library.map((n) => [n.id, n]));
  const signature = new Map<string, LibraryNode>();

  for (const node of flow.nodes) {
    const lib = byId.get(node.nodeId);
    if (lib) signature.set(node.id, lib);
    else problems.push({ code: "unknown-node", flowNodeId: node.id, message: `Node ${node.nodeId} is not in the library` });
  }

  const isEntry = (id: string) => {
    const kind = signature.get(id)?.kind;
    return kind !== undefined && isEntryKind(kind);
  };
  const entryNodes = flow.nodes.filter((n) => isEntry(n.id));
  if (entryNodes.length !== 1) {
    problems.push({ code: "entry-count", message: `A Flow needs exactly one Input Node, found ${entryNodes.length}` });
  }

  const hasOutgoing = new Set(flow.edges.map((e) => e.fromFlowNodeId));
  const endNodes = flow.nodes.filter((n) => !isEntry(n.id) && !hasOutgoing.has(n.id));
  if (endNodes.length === 0) {
    problems.push({ code: "no-end-node", message: "A Flow needs at least one end Node" });
  }

  const connectedInputs = new Set<string>();
  for (const e of flow.edges) {
    const from = signature.get(e.fromFlowNodeId);
    const to = signature.get(e.toFlowNodeId);
    if (!from || !to) continue;
    const output = from.outputs.find((o) => o.name === e.fromOutput);
    const input = to.inputs.find((i) => i.name === e.toInput);
    if (!output || !input) {
      problems.push({ code: "unknown-port", edgeId: e.id, message: `Edge ${e.id} names an Output or input the Node does not have` });
      continue;
    }
    const connect = canConnect(output, input);
    if (!connect.ok) problems.push({ code: "type-mismatch", edgeId: e.id, message: connect.reason });

    const inputKey = `${e.toFlowNodeId}.${e.toInput}`;
    if (connectedInputs.has(inputKey)) {
      problems.push({ code: "input-taken", edgeId: e.id, message: `Input ${e.toInput} of ${to.name} already has an edge` });
    }
    connectedInputs.add(inputKey);

    const placement = flow.nodes.find((n) => n.id === e.fromFlowNodeId);
    if (output.optional && !placement?.enabledOptionalOutputs.includes(output.name)) {
      problems.push({
        code: "optional-output-off",
        edgeId: e.id,
        message: `Optional Output ${output.name} of ${from.name} is turned off`,
      });
    }
  }

  for (const node of flow.nodes) {
    const lib = signature.get(node.id);
    for (const input of lib?.inputs ?? []) {
      if (input.required && !connectedInputs.has(`${node.id}.${input.name}`)) {
        problems.push({
          code: "required-input-unconnected",
          flowNodeId: node.id,
          input: input.name,
          message: `Required input ${input.name} of ${lib?.name} has no edge`,
        });
      }
    }
    for (const group of new Set(lib?.inputs.flatMap((i) => (i.group ? [i.group] : [])))) {
      const members = lib!.inputs.filter((i) => i.group === group);
      if (!members.some((i) => connectedInputs.has(`${node.id}.${i.name}`))) {
        problems.push({
          code: "input-group-unconnected",
          flowNodeId: node.id,
          input: members[0]!.name,
          message: `${lib!.name} needs at least one of: ${members.map((i) => i.name).join(", ")}`,
        });
      }
    }
  }

  for (const e of cycleEdges(flow)) {
    problems.push({ code: "cycle", edgeId: e.id, message: `Edge ${e.id} closes a cycle` });
  }

  return problems;
}

/** Back edges found by a depth-first search in canvas order: each closes one cycle. */
function cycleEdges(flow: Flow): FlowEdge[] {
  const outgoing = groupOutgoing(flow);
  const state = new Map<string, "visiting" | "done">();
  const closing: FlowEdge[] = [];

  const visit = (id: string) => {
    state.set(id, "visiting");
    for (const e of outgoing.get(id) ?? []) {
      const next = state.get(e.toFlowNodeId);
      if (next === "visiting") closing.push(e);
      else if (next === undefined) visit(e.toFlowNodeId);
    }
    state.set(id, "done");
  };

  for (const node of sortByCanvas(flow.nodes)) {
    if (!state.has(node.id)) visit(node.id);
  }
  return closing;
}

function groupOutgoing(flow: Flow): Map<string, FlowEdge[]> {
  const outgoing = new Map<string, FlowEdge[]>();
  const edges = [...flow.edges].sort((a, b) => compare(a.id, b.id));
  for (const e of edges) {
    const list = outgoing.get(e.fromFlowNodeId) ?? [];
    list.push(e);
    outgoing.set(e.fromFlowNodeId, list);
  }
  return outgoing;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function byCanvas(a: FlowNode, b: FlowNode): number {
  return a.y - b.y || a.x - b.x || compare(a.id, b.id);
}

function sortByCanvas(nodes: readonly FlowNode[]): FlowNode[] {
  return [...nodes].sort(byCanvas);
}

/**
 * Flow Node ids in execution order (RUN-2): dependencies first, ties broken by
 * canvas y, then x, then id, so the order never depends on list order.
 */
export function topologicalOrder(flow: Flow): string[] {
  const incoming = new Map(flow.nodes.map((n) => [n.id, 0]));
  for (const e of flow.edges) incoming.set(e.toFlowNodeId, (incoming.get(e.toFlowNodeId) ?? 0) + 1);
  const outgoing = groupOutgoing(flow);

  const ready = sortByCanvas(flow.nodes.filter((n) => incoming.get(n.id) === 0));
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  const order: string[] = [];

  while (ready.length > 0) {
    const node = ready.shift()!;
    order.push(node.id);
    for (const e of outgoing.get(node.id) ?? []) {
      const left = (incoming.get(e.toFlowNodeId) ?? 0) - 1;
      incoming.set(e.toFlowNodeId, left);
      const target = byId.get(e.toFlowNodeId);
      if (left === 0 && target) {
        ready.push(target);
        ready.sort(byCanvas);
      }
    }
  }

  if (order.length !== flow.nodes.length) throw new Error("Flow has a cycle");
  return order;
}
