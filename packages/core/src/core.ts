import type { Clock } from './clock';
import type { NodeExecution, NodeRunner, RunnerEvents } from './runner';
import { deriveTicketStatus, type TicketStatus } from './ticket-status';
import {
  holdsSlot,
  isActiveRun,
  type Attempt,
  type AuditEntry,
  type Batch,
  type Flow,
  type FlowNode,
  type Pod,
  type Run,
  type RunMode,
  type Task,
} from './types';
import { entryNode, topologicalOrder, validateFlow, type FlowProblem } from './validate-flow';

export type CoreErrorCode =
  | 'not-found'
  | 'sample-read-only'
  | 'flow-locked'
  | 'flow-has-problems'
  | 'no-pod'
  | 'pod-exists'
  | 'pod-not-ready'
  | 'pod-busy'
  | 'ticket-has-active-run'
  | 'runner-missing'
  | 'wrong-state'
  | 'invalid';

/** A command the core refuses, with a code the UI can turn into a message. */
export class CoreError extends Error {
  constructor(
    readonly code: CoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CoreError';
  }
}

export interface CoreOptions {
  clock: Clock;
  runners: { dryRun: NodeRunner; real?: NodeRunner };
  tasks?: Task[];
  flows?: Flow[];
}

export interface StartBatchInput {
  /** Email of the Member starting the Batch. */
  starter: string;
  flowId: string;
  tickets: { key: string; issue: string }[];
  mode: RunMode;
  extraInstructions?: string;
}

export interface NeedsYouItem {
  runId: string;
  ticketKey: string;
  nodeId: string;
  nodeName: string;
  kind: 'approve' | 'grill';
  question?: string;
  waitingSince: number;
}

const DEFAULT_SLOTS = 2;

function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * The app core: every rule about Flows, Pods' Slots and queues, Runs and
 * Ticket Status, behind commands and queries. It holds its state in memory
 * and reaches the outside only through a Clock and NodeRunners, so tests
 * drive it with a fake clock and the Dry-run runner. Persistence and the
 * real runner are added around it later.
 */
export class ClauderonCore implements RunnerEvents {
  private readonly clock: Clock;
  private readonly runners: { dryRun: NodeRunner; real?: NodeRunner };
  private readonly tasks = new Map<string, Task>();
  private readonly flows = new Map<string, Flow>();
  private readonly pods = new Map<string, Pod>();
  private readonly runs = new Map<string, Run>();
  private readonly batches = new Map<string, Batch>();
  private readonly audit: AuditEntry[] = [];
  private nextId = 1;
  private nextQueuePosition = 1;

  constructor(options: CoreOptions) {
    this.clock = options.clock;
    this.runners = options.runners;
    for (const task of options.tasks ?? []) this.tasks.set(task.id, clone(task));
    for (const flow of options.flows ?? []) this.flows.set(flow.id, clone(flow));
  }

  // ---------------------------------------------------------------- Tasks

  listTasks(): Task[] {
    return [...this.tasks.values()].map(clone);
  }

  /** Creates or changes a Task. Refused for samples and while a Flow using it is locked. */
  saveTask(task: Task, member: string): Task {
    const existing = this.tasks.get(task.id);
    if (existing?.sample || task.sample) {
      throw new CoreError('sample-read-only', 'Sample Tasks are read-only.');
    }
    if (existing) {
      const locked = [...this.flows.values()].find(
        (flow) => flow.nodes.some((n) => n.taskId === task.id) && this.isFlowLocked(flow.id),
      );
      if (locked) {
        throw new CoreError('flow-locked', `Flow "${locked.name}" uses this Task and has an Active Run.`);
      }
    }
    this.tasks.set(task.id, clone(task));
    this.record({ email: member, action: existing ? 'task.edit' : 'task.create', detail: task.id });
    return clone(task);
  }

  // ---------------------------------------------------------------- Flows

  listFlows(): Flow[] {
    return [...this.flows.values()].map(clone);
  }

  getFlow(flowId: string): Flow {
    return clone(this.flow(flowId));
  }

  flowProblems(flowId: string): FlowProblem[] {
    return validateFlow(this.flow(flowId), this.tasks);
  }

  /** Active Runs (Dry-run included) that use the Flow and so lock it (FLW-7). */
  flowLockHolders(flowId: string): Run[] {
    return [...this.runs.values()].filter((run) => run.flowId === flowId && isActiveRun(run)).map(clone);
  }

  isFlowLocked(flowId: string): boolean {
    return [...this.runs.values()].some((run) => run.flowId === flowId && isActiveRun(run));
  }

  /** Copies a Flow, sample or not, into a new editable Flow. Allowed while the source is locked. */
  cloneFlow(flowId: string, member: string, name?: string): Flow {
    const source = this.flow(flowId);
    const copy: Flow = { ...clone(source), id: this.id('flow'), name: name ?? `${source.name} (copy)`, sample: false };
    this.flows.set(copy.id, copy);
    this.record({ email: member, action: 'flow.clone', flowId: copy.id, detail: `from ${flowId}` });
    return clone(copy);
  }

  /**
   * Creates or changes a Flow. A Flow with problems is saved too; it only
   * cannot start Runs. Refused for samples and while the Flow is locked.
   */
  saveFlow(flow: Flow, member: string): { flow: Flow; problems: FlowProblem[] } {
    const existing = this.flows.get(flow.id);
    if (existing?.sample || flow.sample) {
      throw new CoreError('sample-read-only', 'Sample Flows are read-only; clone one to edit it.');
    }
    if (existing) this.assertFlowUnlocked(flow.id);
    this.flows.set(flow.id, clone(flow));
    this.record({ email: member, action: existing ? 'flow.edit' : 'flow.create', flowId: flow.id });
    return { flow: clone(flow), problems: validateFlow(flow, this.tasks) };
  }

  deleteFlow(flowId: string, member: string): void {
    const flow = this.flow(flowId);
    if (flow.sample) throw new CoreError('sample-read-only', 'Sample Flows cannot be deleted.');
    this.assertFlowUnlocked(flowId);
    this.flows.delete(flowId);
    this.record({ email: member, action: 'flow.delete', flowId });
  }

  // ----------------------------------------------------------------- Pods

  /** Create my Pod: a Member has at most one Pod (POD-2). */
  createPod(owner: string, options: { slots?: number } = {}): Pod {
    if (this.podOf(owner)) throw new CoreError('pod-exists', 'This Member already has a Pod.');
    const pod: Pod = {
      id: this.id('pod'),
      owner,
      slots: options.slots ?? DEFAULT_SLOTS,
      status: 'running',
      claudeLoggedIn: false,
      ghLoggedIn: false,
    };
    this.assertSlots(pod.slots);
    this.pods.set(pod.id, pod);
    this.record({ email: owner, action: 'pod.create', podId: pod.id });
    return clone(pod);
  }

  getPod(podId: string): Pod {
    return clone(this.pod(podId));
  }

  podOfMember(owner: string): Pod | undefined {
    const pod = this.podOf(owner);
    return pod ? clone(pod) : undefined;
  }

  /** The login state the Host Agent reports for a Pod. */
  reportPodLogins(podId: string, logins: { claude: boolean; gh: boolean }): void {
    const pod = this.pod(podId);
    pod.claudeLoggedIn = logins.claude;
    pod.ghLoggedIn = logins.gh;
  }

  /** Slots can change at any time; the change applies from the next scheduling. */
  setSlots(podId: string, slots: number, member: string): void {
    const pod = this.ownPod(podId, member);
    this.assertSlots(slots);
    pod.slots = slots;
    this.record({ email: member, action: 'pod.set-slots', podId, detail: String(slots) });
    this.schedule(pod);
  }

  /** Stop is refused while the Pod has Running or Waiting Runs (POD-6). */
  stopPod(podId: string, member: string): void {
    const pod = this.ownPod(podId, member);
    if (this.slotsInUse(podId) > 0) {
      throw new CoreError('pod-busy', 'The Pod has Running or Waiting Runs.');
    }
    pod.status = 'stopped';
    this.record({ email: member, action: 'pod.stop', podId });
  }

  startPod(podId: string, member: string): void {
    const pod = this.ownPod(podId, member);
    pod.status = 'running';
    this.record({ email: member, action: 'pod.start', podId });
    this.schedule(pod);
  }

  /**
   * The Pod crashed or its Host Agent lost the connection: its Running Runs
   * become Interrupted (RUN-12). Waiting Runs stay, since nothing was
   * executing, and queued Runs wait for the Pod to run again.
   */
  podLost(podId: string): void {
    const pod = this.pod(podId);
    pod.status = 'stopped';
    for (const run of this.runs.values()) {
      if (run.podId !== podId || run.state !== 'running') continue;
      const attempt = this.currentAttempt(run);
      if (attempt?.state === 'running') {
        this.runnerFor(run).cancel(run.id, attempt.id);
        attempt.state = 'interrupted';
        attempt.endedAt = this.clock.now();
      }
      run.state = 'interrupted';
    }
  }

  /** The Pod is running again; its queue resumes. Interrupted Runs wait for a Retry. */
  podRecovered(podId: string): void {
    const pod = this.pod(podId);
    pod.status = 'running';
    this.schedule(pod);
  }

  slotsInUse(podId: string): number {
    return [...this.runs.values()].filter((run) => run.podId === podId && holdsSlot(run)).length;
  }

  /** Queued Runs of a Pod, first in, first out. */
  queue(podId: string): Run[] {
    return this.queued(podId).map(clone);
  }

  // ----------------------------------------------------------------- Runs

  /**
   * Starts one Run per Ticket on the Starter's Pod (RUN-1). Nothing is
   * started when any check fails.
   */
  startBatch(input: StartBatchInput): Batch {
    const flow = this.flow(input.flowId);
    const problems = validateFlow(flow, this.tasks);
    if (problems.length > 0) {
      throw new CoreError('flow-has-problems', `The Flow has ${problems.length} problems and cannot start Runs.`);
    }
    if (input.tickets.length === 0) throw new CoreError('invalid', 'Select at least one Ticket.');
    const keys = new Set(input.tickets.map((t) => t.key));
    if (keys.size !== input.tickets.length) throw new CoreError('invalid', 'A Ticket is selected twice.');

    const pod = this.podOf(input.starter);
    if (!pod) throw new CoreError('no-pod', 'Create your Pod before you start a Run.');

    if (input.mode === 'real') {
      if (!this.runners.real) throw new CoreError('runner-missing', 'The real runner is not available yet.');
      if (!pod.claudeLoggedIn || !pod.ghLoggedIn) {
        throw new CoreError('pod-not-ready', 'Log in to Claude Code and gh in your Pod terminal first.');
      }
      // A Ticket has at most one Active Run; Dry-run Runs do not count (TIC-7).
      const busy = input.tickets.filter((t) => this.activeRealRun(t.key)).map((t) => t.key);
      if (busy.length > 0) {
        throw new CoreError('ticket-has-active-run', `Already has an Active Run: ${busy.join(', ')}.`);
      }
    }

    const now = this.clock.now();
    const batch: Batch = {
      id: this.id('batch'),
      starter: input.starter,
      flowId: flow.id,
      mode: input.mode,
      runIds: [],
      createdAt: now,
    };
    for (const ticket of input.tickets) {
      const run: Run = {
        id: this.id('run'),
        batchId: batch.id,
        ticketKey: ticket.key,
        issue: ticket.issue,
        flowId: flow.id,
        podId: pod.id,
        starter: input.starter,
        mode: input.mode,
        state: 'queued',
        extraInstructions: input.extraInstructions ?? '',
        attempts: [],
        completedNodeIds: [],
        skippedNodeIds: [],
        queuePosition: this.nextQueuePosition++,
        createdAt: now,
      };
      this.runs.set(run.id, run);
      batch.runIds.push(run.id);
      this.record({ email: input.starter, action: 'run.start', runId: run.id, detail: input.mode });
    }
    this.batches.set(batch.id, batch);
    this.schedule(pod);
    return clone(batch);
  }

  getRun(runId: string): Run {
    return clone(this.run(runId));
  }

  listRuns(filter: { state?: Run['state']; flowId?: string; podId?: string } = {}): Run[] {
    return [...this.runs.values()]
      .filter(
        (run) =>
          (!filter.state || run.state === filter.state) &&
          (!filter.flowId || run.flowId === filter.flowId) &&
          (!filter.podId || run.podId === filter.podId),
      )
      .map(clone);
  }

  getBatch(batchId: string): { batch: Batch; runs: Run[] } {
    const batch = this.batches.get(batchId);
    if (!batch) throw new CoreError('not-found', 'Batch not found.');
    return { batch: clone(batch), runs: batch.runIds.map((id) => this.getRun(id)) };
  }

  /** Every Node waiting for a person, across all Runs, oldest first (RUN-5). */
  needsYou(): NeedsYouItem[] {
    const items: NeedsYouItem[] = [];
    for (const run of this.runs.values()) {
      if (run.state !== 'waiting-for-human') continue;
      const attempt = this.currentAttempt(run);
      if (!attempt) continue;
      const node = this.node(run, attempt.nodeId);
      const task = this.task(node.taskId);
      items.push({
        runId: run.id,
        ticketKey: run.ticketKey,
        nodeId: node.id,
        nodeName: node.name,
        kind: task.humanKind === 'grill' ? 'grill' : 'approve',
        question: attempt.question,
        waitingSince: attempt.startedAt,
      });
    }
    return items.sort((a, b) => a.waitingSince - b.waitingSince);
  }

  /** Approve passes the Node's inputs on as its Outputs of the same Output Type. */
  approve(runId: string, member: string): void {
    const { run, attempt, task } = this.waitingHuman(runId, 'approve');
    for (const output of task.outputs) {
      const input = task.inputs.find((i) => i.type === output.type);
      const value = input ? attempt.inputs[input.name] : undefined;
      if (value !== undefined) attempt.outputs[output.name] = value;
    }
    this.record({ email: member, action: 'run.approve', runId });
    this.completeAttempt(run, attempt);
  }

  /** Reject fails the Node and the Run, and keeps the feedback (RUN-6). */
  reject(runId: string, member: string, feedback: string): void {
    const { run, attempt } = this.waitingHuman(runId, 'approve');
    attempt.state = 'failed';
    attempt.feedback = feedback;
    attempt.endedAt = this.clock.now();
    run.state = 'failed';
    run.lastRejectFeedback = feedback;
    this.record({ email: member, action: 'run.reject', runId, detail: feedback });
    this.schedule(this.pod(run.podId));
  }

  /** A Member answers the open question of a Grill Node; Claude continues in the same session. */
  answer(runId: string, member: string, text: string): void {
    const { run, attempt } = this.waitingHuman(runId, 'grill');
    attempt.state = 'running';
    attempt.question = undefined;
    run.state = 'running';
    this.record({ email: member, action: 'run.answer', runId, detail: text });
    this.runnerFor(run).answer(this.execution(run, attempt), text, this);
  }

  /**
   * Retry from a Node of a Failed or Interrupted Run (RUN-7): that Node and
   * every Node after it in execution order run again as new Attempts. The Run
   * goes to the end of its Pod's queue, like a new Run.
   */
  retry(runId: string, nodeId: string, member: string): void {
    const run = this.run(runId);
    if (run.state !== 'failed' && run.state !== 'interrupted') {
      throw new CoreError('wrong-state', 'Only a Failed or Interrupted Run can be retried.');
    }
    const order = topologicalOrder(this.flow(run.flowId)) ?? [];
    const from = order.indexOf(nodeId);
    if (from === -1) throw new CoreError('not-found', 'The Node is not in the Flow of this Run.');
    const again = new Set(order.slice(from));
    run.completedNodeIds = run.completedNodeIds.filter((id) => !again.has(id));
    run.skippedNodeIds = run.skippedNodeIds.filter((id) => !again.has(id));
    run.pendingFeedback = run.lastRejectFeedback ? { nodeId, text: run.lastRejectFeedback } : undefined;
    run.state = 'queued';
    run.queuePosition = this.nextQueuePosition++;
    this.record({ email: member, action: 'run.retry', runId, detail: nodeId });
    this.schedule(this.pod(run.podId));
  }

  /** Cancel ends any Active Run for good (RUN-8). */
  cancel(runId: string, member: string): void {
    const run = this.run(runId);
    if (!isActiveRun(run)) throw new CoreError('wrong-state', 'The Run has already ended.');
    const attempt = this.currentAttempt(run);
    if (attempt && (attempt.state === 'running' || attempt.state === 'waiting-for-human')) {
      this.runnerFor(run).cancel(run.id, attempt.id);
      attempt.state = 'cancelled';
      attempt.endedAt = this.clock.now();
    }
    run.state = 'cancelled';
    run.endedAt = this.clock.now();
    this.record({ email: member, action: 'run.cancel', runId });
    this.schedule(this.pod(run.podId));
  }

  // -------------------------------------------------------- Runner events

  attemptSucceeded(runId: string, attemptId: string, outputs: Record<string, string>): void {
    const found = this.runningAttempt(runId, attemptId);
    if (!found) return;
    const { run, attempt } = found;
    const node = this.node(run, attempt.nodeId);
    const task = this.task(node.taskId);
    for (const output of task.outputs) {
      if (node.disabledOutputs.includes(output.name)) continue;
      const value = outputs[output.name];
      if (value !== undefined) {
        attempt.outputs[output.name] = value;
      } else if (output.required) {
        this.failAttempt(run, attempt, `Required Output "${output.name}" was not produced.`);
        return;
      }
    }
    this.completeAttempt(run, attempt);
  }

  attemptFailed(runId: string, attemptId: string, reason: string): void {
    const found = this.runningAttempt(runId, attemptId);
    if (found) this.failAttempt(found.run, found.attempt, reason);
  }

  attemptAsked(runId: string, attemptId: string, question: string): void {
    const found = this.runningAttempt(runId, attemptId);
    if (!found) return;
    const { run, attempt } = found;
    const task = this.task(this.node(run, attempt.nodeId).taskId);
    if (task.humanKind !== 'grill') {
      this.failAttempt(run, attempt, 'Only a Grill Node can ask a Member a question.');
      return;
    }
    attempt.state = 'waiting-for-human';
    attempt.question = question;
    run.state = 'waiting-for-human';
  }

  // -------------------------------------------------------------- Tickets

  /** Ticket Status from the Ticket's Active Run plus what GitHub says (TIC-6). */
  ticketStatus(ticketKey: string, github: { issueClosed?: boolean; pullRequest?: 'open' | 'merged' } = {}): TicketStatus {
    return deriveTicketStatus({
      issueClosed: github.issueClosed ?? false,
      activeRunState: this.activeRealRun(ticketKey)?.state,
      pullRequest: github.pullRequest,
    });
  }

  auditLog(): AuditEntry[] {
    return this.audit.map(clone);
  }

  // ------------------------------------------------------------ Internals

  /** Starts queued Runs first in, first out while the Pod runs and has free Slots (POD-3). */
  private schedule(pod: Pod): void {
    while (pod.status === 'running' && this.slotsInUse(pod.id) < pod.slots) {
      const next = this.queued(pod.id)[0];
      if (!next) return;
      next.state = 'running';
      this.advance(next);
    }
  }

  /** Starts the next Node of a Run, or ends the Run as Succeeded when none is left (RUN-2). */
  private advance(run: Run): void {
    const flow = this.flow(run.flowId);
    for (const nodeId of topologicalOrder(flow) ?? []) {
      if (run.completedNodeIds.includes(nodeId) || run.skippedNodeIds.includes(nodeId)) continue;
      const node = this.node(run, nodeId);
      const task = this.task(node.taskId);
      const inputs = this.inputsFor(run, flow, node, task);
      if (!inputs) {
        // A required input was never produced, so the Run does not reach this Node.
        run.skippedNodeIds.push(nodeId);
        continue;
      }
      this.startAttempt(run, node, task, inputs);
      return;
    }
    run.state = 'succeeded';
    run.endedAt = this.clock.now();
    this.schedule(this.pod(run.podId));
  }

  private inputsFor(run: Run, flow: Flow, node: FlowNode, task: Task): Record<string, string> | undefined {
    const inputs: Record<string, string> = {};
    const isEntry = entryNode(flow)?.id === node.id;
    for (const input of task.inputs) {
      const edge = flow.edges.find((e) => e.to.nodeId === node.id && e.to.input === input.name);
      let value: string | undefined;
      if (edge) {
        value = this.outputsOf(run, edge.from.nodeId)?.[edge.from.output];
      } else if (isEntry && input.type === 'issue') {
        value = run.issue;
      }
      if (value !== undefined) inputs[input.name] = value;
      else if (input.required) return undefined;
    }
    return inputs;
  }

  /** Outputs of a Node's latest successful Attempt in the current pass. */
  private outputsOf(run: Run, nodeId: string): Record<string, string> | undefined {
    if (!run.completedNodeIds.includes(nodeId)) return undefined;
    return run.attempts.findLast((a) => a.nodeId === nodeId && a.state === 'succeeded')?.outputs;
  }

  private startAttempt(run: Run, node: FlowNode, task: Task, inputs: Record<string, string>): void {
    const parts = [task.instructions, node.extraInstructions, run.extraInstructions];
    if (run.pendingFeedback?.nodeId === node.id) {
      parts.push(`Feedback from the last review\n${run.pendingFeedback.text}`);
      run.pendingFeedback = undefined;
    }
    const isApprove = task.kind === 'human' && task.humanKind === 'approve';
    const attempt: Attempt = {
      id: this.id('attempt'),
      nodeId: node.id,
      number: run.attempts.filter((a) => a.nodeId === node.id).length + 1,
      state: isApprove ? 'waiting-for-human' : 'running',
      instructions: parts.filter((part) => part && part.trim() !== '').join('\n\n'),
      inputs,
      outputs: {},
      startedAt: this.clock.now(),
    };
    run.attempts.push(attempt);
    run.state = attempt.state === 'running' ? 'running' : 'waiting-for-human';
    if (!isApprove) this.runnerFor(run).start(this.execution(run, attempt), this);
  }

  private completeAttempt(run: Run, attempt: Attempt): void {
    attempt.state = 'succeeded';
    attempt.endedAt = this.clock.now();
    run.completedNodeIds.push(attempt.nodeId);
    run.state = 'running';
    this.advance(run);
  }

  private failAttempt(run: Run, attempt: Attempt, reason: string): void {
    attempt.state = 'failed';
    attempt.error = reason;
    attempt.endedAt = this.clock.now();
    run.state = 'failed';
    this.schedule(this.pod(run.podId));
  }

  private execution(run: Run, attempt: Attempt): NodeExecution {
    const node = this.node(run, attempt.nodeId);
    return {
      runId: run.id,
      attemptId: attempt.id,
      ticketKey: run.ticketKey,
      mode: run.mode,
      node: clone(node),
      task: clone(this.task(node.taskId)),
      instructions: attempt.instructions,
      inputs: { ...attempt.inputs },
    };
  }

  private runnerFor(run: Run): NodeRunner {
    const runner = run.mode === 'dry-run' ? this.runners.dryRun : this.runners.real;
    if (!runner) throw new CoreError('runner-missing', 'The real runner is not available yet.');
    return runner;
  }

  private currentAttempt(run: Run): Attempt | undefined {
    return run.attempts[run.attempts.length - 1];
  }

  /** The Attempt a runner event is about, if it is still the running one; late events are ignored. */
  private runningAttempt(runId: string, attemptId: string): { run: Run; attempt: Attempt } | undefined {
    const run = this.runs.get(runId);
    const attempt = run ? this.currentAttempt(run) : undefined;
    if (!run || !attempt || attempt.id !== attemptId) return undefined;
    if (run.state !== 'running' || attempt.state !== 'running') return undefined;
    return { run, attempt };
  }

  private waitingHuman(runId: string, kind: 'approve' | 'grill'): { run: Run; attempt: Attempt; task: Task } {
    const run = this.run(runId);
    const attempt = this.currentAttempt(run);
    if (run.state !== 'waiting-for-human' || !attempt || attempt.state !== 'waiting-for-human') {
      throw new CoreError('wrong-state', 'The Run is not waiting for a person.');
    }
    const task = this.task(this.node(run, attempt.nodeId).taskId);
    if (task.humanKind !== kind) {
      throw new CoreError('wrong-state', kind === 'approve' ? 'This Node waits for an answer.' : 'This Node waits for an approval.');
    }
    return { run, attempt, task };
  }

  private queued(podId: string): Run[] {
    return [...this.runs.values()]
      .filter((run) => run.podId === podId && run.state === 'queued')
      .sort((a, b) => a.queuePosition - b.queuePosition);
  }

  private activeRealRun(ticketKey: string): Run | undefined {
    return [...this.runs.values()].find(
      (run) => run.ticketKey === ticketKey && run.mode === 'real' && isActiveRun(run),
    );
  }

  private assertFlowUnlocked(flowId: string): void {
    const holders = this.flowLockHolders(flowId);
    if (holders.length > 0) {
      throw new CoreError('flow-locked', `Locked by Active Runs: ${holders.map((run) => run.id).join(', ')}.`);
    }
  }

  private assertSlots(slots: number): void {
    if (!Number.isInteger(slots) || slots < 1) throw new CoreError('invalid', 'Slots must be a whole number, 1 or more.');
  }

  private ownPod(podId: string, member: string): Pod {
    const pod = this.pod(podId);
    if (pod.owner !== member) throw new CoreError('invalid', 'Only the owner can change a Pod.');
    return pod;
  }

  private podOf(owner: string): Pod | undefined {
    return [...this.pods.values()].find((pod) => pod.owner === owner);
  }

  private pod(podId: string): Pod {
    const pod = this.pods.get(podId);
    if (!pod) throw new CoreError('not-found', 'Pod not found.');
    return pod;
  }

  private run(runId: string): Run {
    const run = this.runs.get(runId);
    if (!run) throw new CoreError('not-found', 'Run not found.');
    return run;
  }

  private flow(flowId: string): Flow {
    const flow = this.flows.get(flowId);
    if (!flow) throw new CoreError('not-found', 'Flow not found.');
    return flow;
  }

  private task(taskId: string): Task {
    const task = this.tasks.get(taskId);
    if (!task) throw new CoreError('not-found', 'Task not found.');
    return task;
  }

  private node(run: Run, nodeId: string): FlowNode {
    const node = this.flow(run.flowId).nodes.find((n) => n.id === nodeId);
    if (!node) throw new CoreError('not-found', 'Node not found.');
    return node;
  }

  private id(prefix: string): string {
    return `${prefix}-${this.nextId++}`;
  }

  private record(entry: Omit<AuditEntry, 'at'>): void {
    this.audit.push({ at: this.clock.now(), ...entry });
  }
}
