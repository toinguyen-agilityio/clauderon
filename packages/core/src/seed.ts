import type { Flow, FlowNode, Task } from './types';

/** Sample Tasks seeded on first start (FLW-8). They are read-only. */
export const SAMPLE_TASKS: Task[] = [
  {
    id: 'task-grill-a-plan',
    name: 'Grill a plan',
    kind: 'human',
    humanKind: 'grill',
    instructions:
      'Read the issue. Ask the Member every question you need answered, then write an implementation plan.',
    inputs: [{ name: 'issue', type: 'issue', required: true }],
    outputs: [{ name: 'plan', type: 'plan', required: true }],
    sample: true,
  },
  {
    id: 'task-approve-a-plan',
    name: 'Approve a plan',
    kind: 'human',
    humanKind: 'approve',
    inputs: [{ name: 'plan', type: 'plan', required: true }],
    outputs: [{ name: 'plan', type: 'plan', required: true }],
    sample: true,
  },
  {
    id: 'task-code-a-change',
    name: 'Code a change',
    kind: 'agent',
    instructions: 'Implement the plan on the Run branch. Commit your work and summarise what changed and how to test it.',
    inputs: [{ name: 'plan', type: 'plan', required: true }],
    outputs: [
      { name: 'branch', type: 'branch', required: true },
      { name: 'summary', type: 'summary', required: true },
    ],
    sample: true,
  },
  {
    id: 'task-run-tests',
    name: 'Run tests',
    kind: 'command',
    command: 'npm test',
    inputs: [{ name: 'branch', type: 'branch', required: true }],
    outputs: [{ name: 'test-result', type: 'test-result', required: true }],
    sample: true,
  },
  {
    id: 'task-open-a-pull-request',
    name: 'Open a pull request',
    kind: 'agent',
    instructions: 'Push the branch and open a pull request whose body includes "Refs #<issue number>".',
    inputs: [
      { name: 'branch', type: 'branch', required: true },
      { name: 'test-result', type: 'test-result', required: false },
    ],
    // Optional: no pull request is opened when the Run made no changes (RUN-11).
    outputs: [{ name: 'pull-request', type: 'pull-request', required: false }],
    sample: true,
  },
];

function node(id: string, taskId: string, x: number): FlowNode {
  const task = SAMPLE_TASKS.find((t) => t.id === taskId);
  return { id, taskId, name: task?.name ?? taskId, extraInstructions: '', disabledOutputs: [], position: { x, y: 80 } };
}

/** Sample Flows seeded on first start (FLW-8). They are read-only. */
export const SAMPLE_FLOWS: Flow[] = [
  {
    id: 'flow-basic-ticket-delivery',
    name: 'Basic ticket delivery',
    sample: true,
    nodes: [
      node('grill', 'task-grill-a-plan', 0),
      node('code', 'task-code-a-change', 260),
      node('test', 'task-run-tests', 520),
      node('pr', 'task-open-a-pull-request', 780),
    ],
    edges: [
      { id: 'e1', from: { nodeId: 'grill', output: 'plan' }, to: { nodeId: 'code', input: 'plan' } },
      { id: 'e2', from: { nodeId: 'code', output: 'branch' }, to: { nodeId: 'test', input: 'branch' } },
      { id: 'e3', from: { nodeId: 'code', output: 'branch' }, to: { nodeId: 'pr', input: 'branch' } },
      { id: 'e4', from: { nodeId: 'test', output: 'test-result' }, to: { nodeId: 'pr', input: 'test-result' } },
    ],
  },
  {
    id: 'flow-plan-and-deliver',
    name: 'Plan and deliver',
    sample: true,
    nodes: [
      node('grill', 'task-grill-a-plan', 0),
      node('approve', 'task-approve-a-plan', 260),
      node('code', 'task-code-a-change', 520),
      node('test', 'task-run-tests', 780),
      node('pr', 'task-open-a-pull-request', 1040),
    ],
    edges: [
      { id: 'e1', from: { nodeId: 'grill', output: 'plan' }, to: { nodeId: 'approve', input: 'plan' } },
      { id: 'e2', from: { nodeId: 'approve', output: 'plan' }, to: { nodeId: 'code', input: 'plan' } },
      { id: 'e3', from: { nodeId: 'code', output: 'branch' }, to: { nodeId: 'test', input: 'branch' } },
      { id: 'e4', from: { nodeId: 'code', output: 'branch' }, to: { nodeId: 'pr', input: 'branch' } },
      { id: 'e5', from: { nodeId: 'test', output: 'test-result' }, to: { nodeId: 'pr', input: 'test-result' } },
    ],
  },
];
