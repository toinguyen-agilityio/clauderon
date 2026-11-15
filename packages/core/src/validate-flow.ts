import type { Flow, FlowEdge, FlowNode, Task, TaskPort } from './types';

export type FlowProblemCode =
  | 'empty-flow'
  | 'unknown-task'
  | 'unknown-node'
  | 'unknown-port'
  | 'type-mismatch'
  | 'input-connected-twice'
  | 'output-disabled'
  | 'required-output-disabled'
  | 'cycle'
  | 'no-entry-node'
  | 'several-entry-nodes'
  | 'entry-without-issue'
  | 'required-input-unconnected';

export interface FlowProblem {
  code: FlowProblemCode;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export type TaskLookup = ReadonlyMap<string, Task> | readonly Task[];

function toMap(tasks: TaskLookup): ReadonlyMap<string, Task> {
  if (tasks instanceof Map) return tasks;
  return new Map((tasks as readonly Task[]).map((task) => [task.id, task]));
}

function port(ports: TaskPort[], name: string): TaskPort | undefined {
  return ports.find((p) => p.name === name);
}

/**
 * Checks one edge on its own (FLW-4). Returns the problems that make the edge
 * invalid; the canvas calls this before it lets a Member connect two Nodes.
 */
export function checkEdge(flow: Flow, tasks: TaskLookup, edge: FlowEdge): FlowProblem[] {
  const taskMap = toMap(tasks);
  const fromNode = flow.nodes.find((n) => n.id === edge.from.nodeId);
  const toNode = flow.nodes.find((n) => n.id === edge.to.nodeId);
  if (!fromNode || !toNode) {
    return [{ code: 'unknown-node', message: 'The edge points to a Node that is not in the Flow.', edgeId: edge.id }];
  }
  const fromTask = taskMap.get(fromNode.taskId);
  const toTask = taskMap.get(toNode.taskId);
  if (!fromTask || !toTask) return []; // reported once per Node as unknown-task

  const output = port(fromTask.outputs, edge.from.output);
  const input = port(toTask.inputs, edge.to.input);
  if (!output || !input) {
    return [
      {
        code: 'unknown-port',
        message: `"${fromNode.name}" has no Output "${edge.from.output}" or "${toNode.name}" has no input "${edge.to.input}".`,
        edgeId: edge.id,
      },
    ];
  }

  const problems: FlowProblem[] = [];
  if (output.type !== input.type) {
    problems.push({
      code: 'type-mismatch',
      message: `Output Type "${output.type}" of "${fromNode.name}" does not match input "${input.name}" (${input.type}) of "${toNode.name}".`,
      edgeId: edge.id,
    });
  }
  if (fromNode.disabledOutputs.includes(output.name)) {
    problems.push({
      code: 'output-disabled',
      message: `Output "${output.name}" is switched off on "${fromNode.name}".`,
      edgeId: edge.id,
    });
  }
  return problems;
}

/**
 * Nodes in the order a Run executes them (RUN-2). Ties keep the order of
 * `flow.nodes`. Returns null when the Flow has a cycle.
 */
export function topologicalOrder(flow: Flow): string[] | null {
  const ids = new Set(flow.nodes.map((n) => n.id));
  const incoming = new Map<string, number>();
  for (const node of flow.nodes) incoming.set(node.id, 0);
  const edges = flow.edges.filter((e) => ids.has(e.from.nodeId) && ids.has(e.to.nodeId));
  for (const edge of edges) incoming.set(edge.to.nodeId, (incoming.get(edge.to.nodeId) ?? 0) + 1);

  const order: string[] = [];
  const done = new Set<string>();
  while (order.length < flow.nodes.length) {
    const next = flow.nodes.find((n) => !done.has(n.id) && incoming.get(n.id) === 0);
    if (!next) return null;
    done.add(next.id);
    order.push(next.id);
    for (const edge of edges) {
      if (edge.from.nodeId === next.id) incoming.set(edge.to.nodeId, (incoming.get(edge.to.nodeId) ?? 0) - 1);
    }
  }
  return order;
}

/** The entry Node: the only Node without incoming edges, when there is exactly one. */
export function entryNode(flow: Flow): FlowNode | undefined {
  const roots = flow.nodes.filter((n) => !flow.edges.some((e) => e.to.nodeId === n.id));
  return roots.length === 1 ? roots[0] : undefined;
}

/**
 * Validates a Flow before saving (FLW-5): exactly one entry Node that takes
 * the `issue`, at least one end Node, no cycles, no required input left
 * unconnected, and every edge between matching Output Types (FLW-4).
 * A Flow with problems can be saved but cannot start Runs.
 */
export function validateFlow(flow: Flow, tasks: TaskLookup): FlowProblem[] {
  const taskMap = toMap(tasks);
  const problems: FlowProblem[] = [];

  if (flow.nodes.length === 0) {
    return [{ code: 'empty-flow', message: 'The Flow has no Nodes, so it has no entry Node and no end Node.' }];
  }

  for (const node of flow.nodes) {
    const task = taskMap.get(node.taskId);
    if (!task) {
      problems.push({ code: 'unknown-task', message: `"${node.name}" uses a Task that no longer exists.`, nodeId: node.id });
      continue;
    }
    for (const name of node.disabledOutputs) {
      if (port(task.outputs, name)?.required) {
        problems.push({
          code: 'required-output-disabled',
          message: `Output "${name}" of "${node.name}" is required and cannot be switched off.`,
          nodeId: node.id,
        });
      }
    }
  }

  const seenInputs = new Set<string>();
  for (const edge of flow.edges) {
    problems.push(...checkEdge(flow, taskMap, edge));
    const key = `${edge.to.nodeId}\u0000${edge.to.input}`;
    if (seenInputs.has(key)) {
      problems.push({
        code: 'input-connected-twice',
        message: `Input "${edge.to.input}" has more than one incoming edge.`,
        nodeId: edge.to.nodeId,
        edgeId: edge.id,
      });
    }
    seenInputs.add(key);
  }

  if (topologicalOrder(flow) === null) {
    problems.push({ code: 'cycle', message: 'The Flow has a cycle.' });
  }

  const roots = flow.nodes.filter((n) => !flow.edges.some((e) => e.to.nodeId === n.id));
  if (roots.length === 0) {
    problems.push({ code: 'no-entry-node', message: 'The Flow has no entry Node.' });
  } else if (roots.length > 1) {
    for (const root of roots) {
      problems.push({
        code: 'several-entry-nodes',
        message: `"${root.name}" has no incoming edge; a Flow has exactly one entry Node.`,
        nodeId: root.id,
      });
    }
  }
  const entry = roots.length === 1 ? roots[0] : undefined;
  const entryTask = entry ? taskMap.get(entry.taskId) : undefined;
  if (entry && entryTask && !entryTask.inputs.some((i) => i.type === 'issue')) {
    problems.push({
      code: 'entry-without-issue',
      message: `The entry Node "${entry.name}" must take the issue.`,
      nodeId: entry.id,
    });
  }

  for (const node of flow.nodes) {
    const task = taskMap.get(node.taskId);
    if (!task) continue;
    for (const input of task.inputs) {
      if (!input.required) continue;
      if (seenInputs.has(`${node.id}\u0000${input.name}`)) continue;
      // The Run gives the Ticket's issue to the entry Node; extra roots are already reported above.
      if (roots.includes(node) && input.type === 'issue') continue;
      problems.push({
        code: 'required-input-unconnected',
        message: `Required input "${input.name}" of "${node.name}" is not connected.`,
        nodeId: node.id,
      });
    }
  }

  return problems;
}
