import type { Clock } from './clock';
import type { NodeExecution, NodeRunner, RunnerEvents } from './runner';
import type { OutputType } from './types';

export interface DryRunOptions {
  clock: Clock;
  /** Returns a number in [0, 1); defaults to Math.random. */
  random?: () => number;
  /** Share of Attempts that fail, from 0 to 1. Defaults to 0. */
  failureRate?: number;
  minMs?: number;
  maxMs?: number;
}

function issueNumber(ticketKey: string): string {
  return ticketKey.split('#')[1] ?? '0';
}

function fakeOutput(type: OutputType, execution: NodeExecution): string {
  const n = issueNumber(execution.ticketKey);
  switch (type) {
    case 'issue':
      return execution.inputs.issue ?? `Issue ${execution.ticketKey}`;
    case 'plan':
      return `Dry-run plan for ${execution.ticketKey}`;
    case 'branch':
      return `feat/${n}-dry-run`;
    case 'test-result':
      return 'exit 0 (dry-run)';
    case 'pull-request':
      return `#${Number(n) + 1000}`;
    case 'summary':
      return `Dry-run summary for ${execution.ticketKey}: nothing was changed.`;
    case 'screenshot':
      return 'dry-run-screenshot.png';
  }
}

/**
 * The simulated runner of a Dry-run (RUN-13): each Node takes 2–8 s, fails at
 * a configurable rate and returns fake Outputs. It never touches GitHub or
 * Claude and runs inside the app, not in the Pod.
 */
export class DryRunRunner implements NodeRunner {
  private readonly clock: Clock;
  private readonly random: () => number;
  private readonly failureRate: number;
  private readonly minMs: number;
  private readonly maxMs: number;
  private readonly timers = new Map<string, () => void>();

  constructor(options: DryRunOptions) {
    this.clock = options.clock;
    this.random = options.random ?? Math.random;
    this.failureRate = options.failureRate ?? 0;
    this.minMs = options.minMs ?? 2000;
    this.maxMs = options.maxMs ?? 8000;
  }

  start(execution: NodeExecution, events: RunnerEvents): void {
    if (execution.task.humanKind === 'grill') {
      this.schedule(execution, () =>
        events.attemptAsked(execution.runId, execution.attemptId, `Dry-run question about ${execution.ticketKey}?`),
      );
      return;
    }
    this.finishLater(execution, events);
  }

  answer(execution: NodeExecution, _answer: string, events: RunnerEvents): void {
    this.finishLater(execution, events);
  }

  cancel(_runId: string, attemptId: string): void {
    this.timers.get(attemptId)?.();
    this.timers.delete(attemptId);
  }

  private finishLater(execution: NodeExecution, events: RunnerEvents): void {
    this.schedule(execution, () => {
      if (this.random() < this.failureRate) {
        events.attemptFailed(execution.runId, execution.attemptId, 'Simulated failure (Dry-run).');
        return;
      }
      const outputs: Record<string, string> = {};
      for (const output of execution.task.outputs) outputs[output.name] = fakeOutput(output.type, execution);
      events.attemptSucceeded(execution.runId, execution.attemptId, outputs);
    });
  }

  private schedule(execution: NodeExecution, fn: () => void): void {
    const ms = this.minMs + this.random() * (this.maxMs - this.minMs);
    const cancel = this.clock.setTimer(() => {
      this.timers.delete(execution.attemptId);
      fn();
    }, ms);
    this.timers.set(execution.attemptId, cancel);
  }
}
