import { beforeEach, describe, expect, it } from 'vitest';
import {
  ClauderonCore,
  CoreError,
  DryRunRunner,
  FakeClock,
  SAMPLE_FLOWS,
  SAMPLE_TASKS,
  type NodeExecution,
  type NodeRunner,
  type RunnerEvents,
} from '../src';

const ANA = 'ana@example.com';
const BEN = 'ben@example.com';
const BASIC = 'flow-basic-ticket-delivery';
const PLAN = 'flow-plan-and-deliver';

function tickets(count: number, from = 400) {
  return Array.from({ length: count }, (_, i) => ({ key: `ledger-api#${from + i}`, issue: `Issue ${from + i}` }));
}

/** A runner the test drives by hand, standing in for the Host Agent. */
class ManualRunner implements NodeRunner {
  started: NodeExecution[] = [];
  cancelled: string[] = [];
  private events?: RunnerEvents;

  start(execution: NodeExecution, events: RunnerEvents): void {
    this.started.push(execution);
    this.events = events;
  }
  answer(execution: NodeExecution, _answer: string, events: RunnerEvents): void {
    this.started.push(execution);
    this.events = events;
  }
  cancel(_runId: string, attemptId: string): void {
    this.cancelled.push(attemptId);
  }
  get last(): NodeExecution {
    return this.started[this.started.length - 1]!;
  }
  succeed(outputs: Record<string, string>): void {
    this.events!.attemptSucceeded(this.last.runId, this.last.attemptId, outputs);
  }
  fail(reason: string): void {
    this.events!.attemptFailed(this.last.runId, this.last.attemptId, reason);
  }
  ask(question: string): void {
    this.events!.attemptAsked(this.last.runId, this.last.attemptId, question);
  }
}

let clock: FakeClock;
let real: ManualRunner;
let core: ClauderonCore;

function setup(options: { failureRate?: number; random?: () => number } = {}) {
  clock = new FakeClock();
  real = new ManualRunner();
  core = new ClauderonCore({
    clock,
    runners: { dryRun: new DryRunRunner({ clock, random: options.random ?? (() => 0.5), failureRate: options.failureRate }), real },
    tasks: SAMPLE_TASKS,
    flows: SAMPLE_FLOWS,
  });
}

function expectError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(CoreError);
    expect((error as CoreError).code).toBe(code);
    return;
  }
  throw new Error(`expected CoreError ${code}`);
}

/** Answers Grill questions and approves until nothing waits or moves any more. */
function runToEnd() {
  for (let i = 0; i < 200; i++) {
    clock.advance(1000);
    for (const item of core.needsYou()) {
      if (item.kind === 'grill') core.answer(item.runId, BEN, 'yes');
      else core.approve(item.runId, BEN);
    }
  }
}

beforeEach(() => setup());

describe('Slots and the Pod queue', () => {
  it('never runs more than the Pod has Slots, and starts the rest first in, first out (A2)', () => {
    const pod = core.createPod(ANA, { slots: 2 });
    const batch = core.startBatch({ starter: ANA, flowId: BASIC, tickets: tickets(10), mode: 'dry-run' });

    const startOrder: string[] = [];
    let maxInUse = 0;
    for (let i = 0; i < 400; i++) {
      clock.advance(500);
      for (const item of core.needsYou()) core.answer(item.runId, BEN, 'yes');
      maxInUse = Math.max(maxInUse, core.slotsInUse(pod.id));
      for (const run of core.listRuns()) {
        if (run.state !== 'queued' && !startOrder.includes(run.id)) startOrder.push(run.id);
      }
    }

    expect(maxInUse).toBe(2);
    expect(startOrder).toEqual(batch.runIds);
    expect(core.listRuns().every((run) => run.state === 'succeeded')).toBe(true);
    expect(core.queue(pod.id)).toEqual([]);
  });

  it('keeps Runs queued while the Pod is stopped and starts them when it runs again', () => {
    const pod = core.createPod(ANA);
    core.stopPod(pod.id, ANA);
    core.startBatch({ starter: ANA, flowId: BASIC, tickets: tickets(1), mode: 'dry-run' });
    expect(core.queue(pod.id)).toHaveLength(1);
    core.startPod(pod.id, ANA);
    expect(core.queue(pod.id)).toHaveLength(0);
    expect(core.slotsInUse(pod.id)).toBe(1);
  });

  it('applies a Slot change from the next scheduling without stopping Runs', () => {
    const pod = core.createPod(ANA, { slots: 1 });
    core.startBatch({ starter: ANA, flowId: BASIC, tickets: tickets(3), mode: 'dry-run' });
    expect(core.slotsInUse(pod.id)).toBe(1);
    core.setSlots(pod.id, 3, ANA);
    expect(core.slotsInUse(pod.id)).toBe(3);
    core.setSlots(pod.id, 1, ANA);
    expect(core.slotsInUse(pod.id)).toBe(3);
  });

  it('refuses Stop while the Pod has Running or Waiting Runs', () => {
    const pod = core.createPod(ANA);
    core.startBatch({ starter: ANA, flowId: BASIC, tickets: tickets(1), mode: 'dry-run' });
    expectError(() => core.stopPod(pod.id, ANA), 'pod-busy');
  });

  it('gives a Member at most one Pod', () => {
    core.createPod(ANA);
    expectError(() => core.createPod(ANA), 'pod-exists');
  });
});

describe('Start', () => {
  it('is refused without a Pod', () => {
    expectError(() => core.startBatch({ starter: ANA, flowId: BASIC, tickets: tickets(1), mode: 'dry-run' }), 'no-pod');
  });

  it('is refused for a Real Run until Claude Code and gh are logged in; a Dry-run needs no login', () => {
    const pod = core.createPod(ANA);
    expectError(() => core.startBatch({ starter: ANA, flowId: BASIC, tickets: tickets(1), mode: 'real' }), 'pod-not-ready');
    core.startBatch({ starter: ANA, flowId: BASIC, tickets: tickets(1), mode: 'dry-run' });
    core.reportPodLogins(pod.id, { claude: true, gh: true });
    core.startBatch({ starter: ANA, flowId: BASIC, tickets: tickets(1), mode: 'real' });
    expect(real.started).toHaveLength(1);
  });

  it('is refused for a Flow with problems', () => {
    core.createPod(ANA);
    const flow = core.cloneFlow(BASIC, ANA);
    flow.edges = flow.edges.filter((e) => e.id !== 'e1');
    expect(core.saveFlow(flow, ANA).problems).not.toEqual([]);
    expectError(() => core.startBatch({ starter: ANA, flowId: flow.id, tickets: tickets(1), mode: 'dry-run' }), 'flow-has-problems');
  });

  it('allows one Active Run per Ticket; Dry-run Runs do not count', () => {
    const pod = core.createPod(ANA);
    core.reportPodLogins(pod.id, { claude: true, gh: true });
    core.startBatch({ starter: ANA, flowId: BASIC, tickets: tickets(1), mode: 'dry-run' });
    core.startBatch({ starter: ANA, flowId: BASIC, tickets: tickets(1), mode: 'real' });
    expectError(() => core.startBatch({ starter: ANA, flowId: BASIC, tickets: tickets(2), mode: 'real' }), 'ticket-has-active-run');
    core.startBatch({ starter: ANA, flowId: BASIC, tickets: tickets(1), mode: 'dry-run' });
    expect(core.listRuns()).toHaveLength(3);
  });
});

describe('A Run through its Flow', () => {
  function startReal(flowId = PLAN) {
    const pod = core.createPod(ANA, { slots: 1 });
    core.reportPodLogins(pod.id, { claude: true, gh: true });
    const batch = core.startBatch({ starter: ANA, flowId, tickets: tickets(1, 412), mode: 'real', extraInstructions: 'Keep it small.' });
    return { pod, runId: batch.runIds[0]! };
  }

  /** Drives Plan and deliver up to the Approve Node. */
  function toApprove() {
    const started = startReal();
    real.ask('Which database?');
    core.answer(started.runId, BEN, 'Postgres');
    real.succeed({ plan: 'The plan' });
    return started;
  }

  it('runs Nodes one at a time, passes Outputs along the edges and succeeds', () => {
    const { runId } = startReal();
    expect(real.last.node.id).toBe('grill');
    expect(real.last.inputs).toEqual({ issue: 'Issue 412' });
    expect(real.last.instructions).toContain('Keep it small.');

    real.ask('Which database?');
    expect(core.getRun(runId).state).toBe('waiting-for-human');
    expect(core.needsYou()).toMatchObject([{ runId, kind: 'grill', question: 'Which database?' }]);
    expect(core.ticketStatus('ledger-api#412')).toBe('Needs you');

    core.answer(runId, BEN, 'Postgres');
    real.succeed({ plan: 'The plan' });
    expect(core.needsYou()).toMatchObject([{ runId, kind: 'approve' }]);

    core.approve(runId, BEN);
    expect(real.last.node.id).toBe('code');
    expect(real.last.inputs).toEqual({ plan: 'The plan' });

    real.succeed({ branch: 'clauderon/412-x', summary: 'Changed things' });
    expect(real.last.node.id).toBe('test');
    real.succeed({ 'test-result': 'exit 0' });
    expect(real.last.inputs).toEqual({ branch: 'clauderon/412-x', 'test-result': 'exit 0' });
    real.succeed({ 'pull-request': '#88' });

    const run = core.getRun(runId);
    expect(run.state).toBe('succeeded');
    expect(run.attempts.map((a) => a.nodeId)).toEqual(['grill', 'approve', 'code', 'test', 'pr']);
    expect(core.ticketStatus('ledger-api#412', { pullRequest: 'open' })).toBe('PR open');
  });

  it('succeeds without a pull request when the Run made no changes', () => {
    const { runId } = toApprove();
    core.approve(runId, BEN);
    real.succeed({ branch: 'b', summary: 's' });
    real.succeed({ 'test-result': 'exit 0' });
    real.succeed({});
    expect(core.getRun(runId).state).toBe('succeeded');
    expect(core.ticketStatus('ledger-api#412')).toBe('Open');
  });

  it('fails the Node when a required Output is missing', () => {
    const { runId } = toApprove();
    core.approve(runId, BEN);
    real.succeed({ branch: 'b' });
    const run = core.getRun(runId);
    expect(run.state).toBe('failed');
    expect(run.attempts.at(-1)?.error).toContain('summary');
  });

  it('Reject fails the Run; Retry passes the feedback to the retried Node and keeps earlier Attempts', () => {
    const { pod, runId } = toApprove();
    core.reject(runId, BEN, 'Too big, split it.');
    expect(core.getRun(runId).state).toBe('failed');
    expect(core.slotsInUse(pod.id)).toBe(0);
    expect(core.ticketStatus('ledger-api#412')).toBe('Failed');

    core.retry(runId, 'grill', ANA);
    expect(real.last.node.id).toBe('grill');
    expect(real.last.instructions).toContain('Feedback from the last review\nToo big, split it.');

    real.succeed({ plan: 'A smaller plan' });
    core.approve(runId, BEN);
    expect(real.last.inputs).toEqual({ plan: 'A smaller plan' });

    const run = core.getRun(runId);
    expect(run.attempts.filter((a) => a.nodeId === 'grill').map((a) => [a.number, a.state])).toEqual([
      [1, 'succeeded'],
      [2, 'succeeded'],
    ]);
    expect(run.attempts.find((a) => a.nodeId === 'approve')?.feedback).toBe('Too big, split it.');
  });

  it('puts a retried Run at the end of the queue', () => {
    const { pod, runId } = startReal(BASIC);
    const second = core.startBatch({ starter: ANA, flowId: BASIC, tickets: tickets(2, 500), mode: 'real' });
    real.fail('boom');
    // The Slot is free again, so the next queued Run started.
    expect(core.getRun(second.runIds[0]!).state).toBe('running');
    core.retry(runId, 'grill', ANA);
    expect(core.queue(pod.id).map((run) => run.id)).toEqual([second.runIds[1], runId]);
  });

  it('keeps a Failed Run active: it holds the Ticket and the Flow lock, but no Slot', () => {
    const { pod, runId } = startReal(BASIC);
    real.fail('boom');
    expect(core.slotsInUse(pod.id)).toBe(0);
    expect(core.isFlowLocked(BASIC)).toBe(true);
    expectError(() => core.startBatch({ starter: ANA, flowId: BASIC, tickets: tickets(1, 412), mode: 'real' }), 'ticket-has-active-run');
    core.cancel(runId, BEN);
    expect(core.getRun(runId).state).toBe('cancelled');
    expect(core.isFlowLocked(BASIC)).toBe(false);
    expect(core.ticketStatus('ledger-api#412')).toBe('Open');
  });

  it('Cancel stops the running Attempt and ignores what the runner reports afterwards', () => {
    const { runId } = startReal(BASIC);
    const attemptId = real.last.attemptId;
    core.cancel(runId, BEN);
    expect(real.cancelled).toEqual([attemptId]);
    real.succeed({ plan: 'late' });
    expect(core.getRun(runId).state).toBe('cancelled');
    expectError(() => core.cancel(runId, BEN), 'wrong-state');
  });

  it('interrupts Running Runs when the Pod is lost, but not Waiting ones; nothing retries by itself', () => {
    const pod = core.createPod(ANA, { slots: 2 });
    core.reportPodLogins(pod.id, { claude: true, gh: true });
    const batch = core.startBatch({ starter: ANA, flowId: BASIC, tickets: tickets(3), mode: 'real' });
    const [first, second, third] = batch.runIds as [string, string, string];
    real.ask('A question for the second Run?');

    core.podLost(pod.id);
    expect(core.getRun(first).state).toBe('interrupted');
    expect(core.getRun(second).state).toBe('waiting-for-human');
    expect(core.getRun(third).state).toBe('queued');

    core.podRecovered(pod.id);
    expect(core.getRun(first).state).toBe('interrupted');
    expect(core.getRun(third).state).toBe('running');
    expect(core.ticketStatus('ledger-api#400')).toBe('Interrupted');

    core.retry(first, 'grill', ANA);
    expect(core.getRun(first).state).toBe('queued');
  });

  it('records who did what', () => {
    const { runId } = toApprove();
    core.approve(runId, BEN);
    const actions = core.auditLog().map((entry) => `${entry.email} ${entry.action}`);
    expect(actions).toEqual([
      `${ANA} pod.create`,
      `${ANA} run.start`,
      `${BEN} run.answer`,
      `${BEN} run.approve`,
    ]);
  });
});

describe('Dry-run', () => {
  it('takes 2–8 s per Node and returns fake Outputs', () => {
    core.createPod(ANA);
    const batch = core.startBatch({ starter: ANA, flowId: PLAN, tickets: tickets(1, 412), mode: 'dry-run' });
    const runId = batch.runIds[0]!;
    clock.advance(4999);
    expect(core.needsYou()).toEqual([]);
    clock.advance(1);
    expect(core.needsYou()).toHaveLength(1);

    runToEnd();
    const run = core.getRun(runId);
    expect(run.state).toBe('succeeded');
    expect(run.attempts.find((a) => a.nodeId === 'code')?.outputs.branch).toBe('feat/412-dry-run');
    expect(core.ticketStatus('ledger-api#412')).toBe('Open');
  });

  it('fails Nodes at the configured rate', () => {
    setup({ failureRate: 1 });
    core.createPod(ANA);
    const batch = core.startBatch({ starter: ANA, flowId: PLAN, tickets: tickets(1), mode: 'dry-run' });
    runToEnd();
    expect(core.getRun(batch.runIds[0]!).state).toBe('failed');
  });
});

describe('Flow lock and samples', () => {
  it('keeps samples read-only; a clone can be edited', () => {
    const sample = core.getFlow(BASIC);
    expectError(() => core.saveFlow(sample, ANA), 'sample-read-only');
    expectError(() => core.deleteFlow(BASIC, ANA), 'sample-read-only');
    const copy = core.cloneFlow(BASIC, ANA, 'My delivery');
    expect(copy.sample).toBe(false);
    copy.name = 'Renamed';
    expect(core.saveFlow(copy, BEN).problems).toEqual([]);
    expect(core.getFlow(copy.id).name).toBe('Renamed');
  });

  it('locks a Flow while an Active Run uses it, Dry-run included; it can still be cloned', () => {
    core.createPod(ANA);
    const flow = core.cloneFlow(BASIC, ANA);
    const batch = core.startBatch({ starter: ANA, flowId: flow.id, tickets: tickets(1), mode: 'dry-run' });
    expectError(() => core.saveFlow(flow, ANA), 'flow-locked');
    expectError(() => core.deleteFlow(flow.id, ANA), 'flow-locked');
    expect(core.flowLockHolders(flow.id).map((run) => run.id)).toEqual(batch.runIds);
    core.cloneFlow(flow.id, BEN);

    runToEnd();
    core.saveFlow(flow, ANA);
    core.deleteFlow(flow.id, ANA);
  });

  it('refuses to edit a Task while a Flow using it is locked', () => {
    core.createPod(ANA);
    const task = { ...SAMPLE_TASKS[3]!, id: 'task-lint', name: 'Lint', command: 'npm run lint', sample: false };
    core.saveTask(task, ANA);
    const flow = core.cloneFlow(BASIC, ANA);
    flow.nodes.find((n) => n.id === 'test')!.taskId = task.id;
    core.saveFlow(flow, ANA);
    core.startBatch({ starter: ANA, flowId: flow.id, tickets: tickets(1), mode: 'dry-run' });
    expectError(() => core.saveTask({ ...task, command: 'npm run lint -- --fix' }, ANA), 'flow-locked');
    expectError(() => core.saveTask(SAMPLE_TASKS[0]!, ANA), 'sample-read-only');
  });
});
