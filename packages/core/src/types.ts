// Domain words follow CONTEXT.md: Task, Flow, Node, Output, Output Type.

export const OUTPUT_TYPES = [
  'issue',
  'plan',
  'branch',
  'test-result',
  'pull-request',
  'summary',
  'screenshot',
] as const;

export type OutputType = (typeof OUTPUT_TYPES)[number];

export type TaskKind = 'agent' | 'command' | 'human';
export type HumanKind = 'approve' | 'grill';

/** A typed input or Output of a Task. */
export interface TaskPort {
  name: string;
  type: OutputType;
  required: boolean;
}

export interface Task {
  id: string;
  name: string;
  kind: TaskKind;
  /** Set only when kind is 'human'. */
  humanKind?: HumanKind;
  /** Instructions for an Agent or Grill Task. */
  instructions?: string;
  /** Shell command of a Command Task. */
  command?: string;
  inputs: TaskPort[];
  outputs: TaskPort[];
  /** Sample Tasks are read-only; Members clone them to edit. */
  sample: boolean;
}

export interface FlowNode {
  id: string;
  taskId: string;
  name: string;
  extraInstructions: string;
  /** Names of optional Outputs switched off on this Node (FLW-6). */
  disabledOutputs: string[];
  position?: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  from: { nodeId: string; output: string };
  to: { nodeId: string; input: string };
}

export interface Flow {
  id: string;
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Sample Flows are read-only; Members clone them to edit. */
  sample: boolean;
}

export type RunMode = 'real' | 'dry-run';

export type RunState =
  | 'queued'
  | 'running'
  | 'waiting-for-human'
  | 'succeeded'
  | 'failed'
  | 'interrupted'
  | 'cancelled';

export type AttemptState =
  | 'running'
  | 'waiting-for-human'
  | 'succeeded'
  | 'failed'
  | 'interrupted'
  | 'cancelled';

/** One execution of a Node within a Run. */
export interface Attempt {
  id: string;
  nodeId: string;
  /** 1 for the first Attempt of this Node in the Run, then 2, 3... */
  number: number;
  state: AttemptState;
  instructions: string;
  inputs: Record<string, string>;
  outputs: Record<string, string>;
  /** Open question of a Grill Node while it waits for a Member. */
  question?: string;
  /** Feedback of a Reject on an Approve Node. */
  feedback?: string;
  error?: string;
  startedAt: number;
  endedAt?: number;
}

export interface Run {
  id: string;
  batchId: string;
  ticketKey: string;
  /** Issue text given to the entry Node. */
  issue: string;
  flowId: string;
  podId: string;
  /** Email of the Member who started the Run. */
  starter: string;
  mode: RunMode;
  state: RunState;
  extraInstructions: string;
  attempts: Attempt[];
  /** Nodes done in the current pass; Retry removes the retried Node and later ones. */
  completedNodeIds: string[];
  /** Nodes not reached because a required input was never produced. */
  skippedNodeIds: string[];
  /** Position in the Pod's queue; a Retry gets a new, later one. */
  queuePosition: number;
  /** Reject feedback waiting to be passed to a retried Node (RUN-7). */
  pendingFeedback?: { nodeId: string; text: string };
  lastRejectFeedback?: string;
  createdAt: number;
  endedAt?: number;
}

export interface Batch {
  id: string;
  starter: string;
  flowId: string;
  mode: RunMode;
  runIds: string[];
  createdAt: number;
}

export type PodStatus = 'running' | 'stopped';

export interface Pod {
  id: string;
  /** Email of the Member who owns the Pod. */
  owner: string;
  slots: number;
  status: PodStatus;
  claudeLoggedIn: boolean;
  ghLoggedIn: boolean;
}

export interface AuditEntry {
  at: number;
  email: string;
  action: string;
  runId?: string;
  podId?: string;
  flowId?: string;
  detail?: string;
}

export const ACTIVE_RUN_STATES: readonly RunState[] = [
  'queued',
  'running',
  'waiting-for-human',
  'failed',
  'interrupted',
];

/** An Active Run has not ended as Succeeded or Cancelled. */
export function isActiveRun(run: Pick<Run, 'state'>): boolean {
  return ACTIVE_RUN_STATES.includes(run.state);
}

/** A Run holds a Slot only while Running or Waiting for human. */
export function holdsSlot(run: Pick<Run, 'state'>): boolean {
  return run.state === 'running' || run.state === 'waiting-for-human';
}
