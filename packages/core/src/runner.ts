import type { FlowNode, RunMode, Task } from './types';

/** What a runner needs to execute one Attempt of a Node. */
export interface NodeExecution {
  runId: string;
  attemptId: string;
  ticketKey: string;
  mode: RunMode;
  node: FlowNode;
  task: Task;
  /** Task instructions, the Node's and Run's extra instructions, and any Reject feedback. */
  instructions: string;
  inputs: Record<string, string>;
}

/** How a runner reports back to the core. */
export interface RunnerEvents {
  attemptSucceeded(runId: string, attemptId: string, outputs: Record<string, string>): void;
  attemptFailed(runId: string, attemptId: string, reason: string): void;
  /** A Grill Node asks a Member; the Run waits for the answer. */
  attemptAsked(runId: string, attemptId: string, question: string): void;
}

/**
 * Executes Agent, Command and Grill Nodes. The Dry-run runner lives in this
 * package; the real runner (Host Agent in the Starter's Pod) plugs in later.
 * Approve Nodes never reach a runner: the core handles them itself.
 */
export interface NodeRunner {
  start(execution: NodeExecution, events: RunnerEvents): void;
  /** Continues a Grill Node with the Member's answer. */
  answer(execution: NodeExecution, answer: string, events: RunnerEvents): void;
  /** Stops an Attempt that is running or waiting; no event is sent back. */
  cancel(runId: string, attemptId: string): void;
}
