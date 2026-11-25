import {
  activeOutputs,
  isEntryKind,
  branchName,
  buildAgentPrompt,
  buildGrillAnswerPrompt,
  checkAgentResult,
  commandOutputs,
  mask,
  nextNode,
  parseGrillQuestions,
  renderRetryContext,
  schedule,
  scrubTarget,
  snapshotFlow,
  type Clock,
  type FlowSnapshot,
  type GrillAnswers,
  type GrillQuestion,
  type OutputType,
  type OutputValue,
  type RetryContext,
  type SnapshotNode,
} from "@clauderon/core";
import {
  appendLogChunk,
  askHuman,
  attemptsOfRun,
  createAttempt,
  finishAttempt,
  getAttempt,
  getMachine,
  getRunContext,
  interruptRun,
  latestAnsweredRound,
  markRetryLoginsChecked,
  moveRun,
  runningAttemptIds,
  runningRuns,
  runsToCleanUp,
  runsOfMachine,
  appendAttemptTurns,
  setAttemptUsage,
  updateRun,
  type AttemptWithOutputs,
  type Db,
  type Machine,
} from "@clauderon/db";
import type { MessageType, Payload } from "@clauderon/protocol";
import type { LiveHub } from "./live-hub";

/** Sends a numbered message to one Machine's Agent. */
export type Sender = { send<T extends MessageType>(machineId: string, type: T, payload: Payload<T>): unknown };

export type RunEngineOptions = {
  db: Db;
  links: Sender;
  clock: Clock;
  live: LiveHub;
  /** The app's own secrets, masked again before a log line is stored (NFR-1). */
  secrets: readonly string[];
  log?: (message: string) => void;
};

/** What the Gateway learned from a Machine's `hello` (spec M3 §6). */
export type MachineBack = {
  liveAttempts: readonly string[];
  /** The Agent process changed, or this Gateway just booted: lost Attempts cannot report any more. */
  checkLive: boolean;
  reason: string;
};

type RunContext = NonNullable<Awaited<ReturnType<typeof getRunContext>>>;

/**
 * The Run engine (spec M1 §4.2): the Gateway owns every Run; each Machine's
 * Agent only executes and reports. State lives in the database, so each step reads
 * it again; work is serialised so two triggers never start the same Slot.
 */
export class RunEngine {
  private queue: Promise<void> = Promise.resolve();
  /** Grill rounds whose resume was sent, so a repeated command never runs one twice. */
  private resumedRounds = new Set<string>();

  constructor(private readonly opts: RunEngineOptions) {}

  /** Resolves once all queued work has finished. */
  idle(): Promise<void> {
    return this.queue;
  }

  private serial(task: () => Promise<void>): Promise<void> {
    this.queue = this.queue.then(task).catch((error: unknown) => this.log(`run engine error: ${error instanceof Error ? error.stack : String(error)}`));
    return this.queue;
  }

  /** The Slot scheduler for one Machine (POD-3), after every change on it. */
  schedule(machineId: string): Promise<void> {
    return this.serial(() => this.scheduleNow(machineId));
  }

  private async scheduleNow(machineId: string): Promise<void> {
    // Queued Runs wait for their Machine (spec M3 §6); its next hello schedules it.
    const machine = await getMachine(this.opts.db, machineId);
    if (!machine) return;
    const runs = await runsOfMachine(this.opts.db, machineId, ["queued", "running", "waiting_for_human"]);
    for (const runId of schedule(machine, runs)) {
      const moved = await moveRun(this.opts.db, runId, "queued", { state: "running", startedAt: this.now() });
      if (!moved) continue;
      this.opts.live.runChanged(runId);
    }
    // A login check right before each Run's first Node (POD-5); its answer
    // prepares the Workspace of every Run still waiting for it.
    if (runs.length > 0 && (await this.waitingForLogins(machineId)).length > 0) this.opts.links.send(machineId, "machine.checkLogins", {});
  }

  /** Runs waiting for their login check: new ones, and retried ones (spec M3 §4). */
  private async waitingForLogins(machineId: string) {
    return (await runsOfMachine(this.opts.db, machineId, ["running"])).filter(
      (r) => r.branch === null || (r.pendingRetry !== null && !r.pendingRetry.loginsChecked),
    );
  }

  /**
   * The web app cancelled a Run (RUN-8): it already ended the Run and its
   * Attempts, so only kill what still executes, then free the Slot.
   */
  cancelled({ machineId, runId, attemptIds }: { machineId: string; runId: string; attemptIds: readonly string[] }): Promise<void> {
    return this.serial(async () => {
      for (const attemptId of attemptIds) this.opts.links.send(machineId, "node.kill", { attemptId });
      await this.ended(runId, machineId);
    });
  }

  /** After a `machine.logins`: fail or prepare the Runs that waited for it. */
  loginsChecked(machine: Machine): Promise<void> {
    return this.serial(async () => {
      for (const run of await this.waitingForLogins(machine.id)) {
        if (!machine.claudeLoggedIn) await this.fail(run.id, "Claude Code not logged in");
        else if (!machine.ghLoggedIn) await this.fail(run.id, "gh not logged in");
        else if (run.pendingRetry) {
          // A retried Run keeps its worktree (RUN-7); one that never got it prepares it now.
          await markRetryLoginsChecked(this.opts.db, run.id);
          if (run.worktreePath) await this.advance(run.id);
          else await this.prepare(run.id);
        } else await this.prepare(run.id);
      }
    });
  }

  private async prepare(runId: string): Promise<void> {
    const ctx = await getRunContext(this.opts.db, runId);
    // Only an ended Run can have lost its Machine; nothing drives it any more.
    if (!ctx?.run.machineId) return;
    const branch = branchName(ctx.ticket?.number ?? null, ctx.title, runId);
    await updateRun(this.opts.db, runId, { branch });
    this.opts.links.send(ctx.run.machineId, "workspace.prepare", {
      runId,
      owner: ctx.project.owner,
      repo: ctx.project.repo,
      // A branch Input is where the Run starts from; it still gets a branch of its own.
      baseBranch: ctx.run.inputValue?.type === "branch" ? ctx.run.inputValue.value.branch : ctx.project.baseBranch,
      branch,
    });
  }

  workspaceReady({ runId, worktreePath }: Payload<"workspace.ready">): Promise<void> {
    return this.serial(async () => {
      await updateRun(this.opts.db, runId, { worktreePath });
      await this.advance(runId);
      // Cancelled while its Workspace was being prepared: the worktree is no use to anyone.
      await this.cleanUp(runId);
    });
  }

  /** The Agent removed a Run's worktree (RUN-14): nothing is left to clean up. */
  workspaceCleaned({ runId }: Payload<"workspace.cleaned">): Promise<void> {
    return this.serial(async () => {
      const ctx = await getRunContext(this.opts.db, runId);
      if (ctx && (ctx.run.state === "succeeded" || ctx.run.state === "cancelled")) await updateRun(this.opts.db, runId, { worktreePath: null });
    });
  }

  workspaceFailed({ runId, error }: Payload<"workspace.failed">): Promise<void> {
    return this.serial(() => this.fail(runId, `Workspace: ${this.hide(error)}`));
  }

  /**
   * Starts the next Node, or ends the Run when none is left (RUN-2, RUN-16).
   * Only Attempts of the current pass count: a Retry supersedes the rest
   * (RUN-7). A Run already running or waiting at a Node is left alone.
   */
  private async advance(runId: string): Promise<void> {
    const ctx = await getRunContext(this.opts.db, runId);
    const machineId = ctx?.run.machineId;
    if (!ctx || !machineId || ctx.run.state !== "running") return;
    const all = await attemptsOfRun(this.opts.db, runId);
    const attempts = all.filter((a) => !a.superseded);
    if (attempts.some((a) => a.state === "running" || a.state === "waiting_for_human")) return;
    const views = attempts.map((a) => ({ flowNodeId: a.flowNodeId, state: a.state, outputs: a.outputs.map((o) => o.name) }));
    const next = nextNode(snapshotFlow(ctx.snapshot), views);

    if (next === "done") {
      if (await moveRun(this.opts.db, runId, "running", { state: "succeeded", endedAt: this.now() })) await this.ended(runId, machineId);
      return;
    }

    const node = ctx.snapshot.nodes.find((n) => n.id === next)!;
    const attempt = await createAttempt(this.opts.db, {
      runId,
      flowNodeId: node.id,
      number: all.filter((a) => a.flowNodeId === node.id).length + 1,
      startedAt: this.now(),
    });
    this.opts.live.runChanged(runId);

    if (isEntryKind(node.kind)) {
      // Not executed: it emits the Run's input at once (spec M1 §4.2 step 4).
      const output = node.outputs[0];
      const value = output && this.entryValue(ctx, output.type);
      if (!output || value === undefined) {
        return this.failAttempt(ctx, attempt.id, "The Run has no value for its Input Node", { endedAt: this.now(), exitCode: -1, claudeSessionId: null });
      }
      await finishAttempt(this.opts.db, attempt.id, {
        state: "succeeded",
        endedAt: this.now(),
        outputs: [{ name: output.name, type: output.type, value }],
      });
      return this.advance(runId);
    }

    const inputs = this.inputsOf(ctx.snapshot, node, attempts);
    if (node.kind === "approve") {
      // Waits for a person with the input it passes through (spec M3 §2.1); no timeout.
      const input = inputs[0] ?? null;
      await askHuman(this.opts.db, { runId, attemptId: attempt.id, kind: "approve", questions: { input }, now: this.now() });
      this.opts.live.runChanged(runId);
      return;
    }

    const retryContext = attempt.retryContext as RetryContext | null;
    const base = { attemptId: attempt.id, runId, worktreePath: ctx.run.worktreePath ?? "" };
    if (node.kind === "agent" || node.kind === "grill") {
      const outputs = activeOutputs(node.outputs, node.enabledOptionalOutputs);
      const prompt = buildAgentPrompt({
        instructions: node.instructions,
        placementInstructions: node.extraInstructions,
        batchInstructions: ctx.batchInstructions,
        inputs,
        outputs: outputs.map((o) => o.name),
        grill: node.kind === "grill",
        retryContext,
      });
      this.opts.links.send(machineId, "node.run", { ...base, kind: "agent", prompt, env: this.agentEnv(node) });
    } else {
      const env = this.commandEnv(ctx, inputs);
      // The Host Agent turns it into $CLAUDERON_RETRY_CONTEXT_FILE (spec M3 §4).
      if (retryContext) env.CLAUDERON_RETRY_CONTEXT = renderRetryContext(retryContext);
      this.opts.links.send(machineId, "node.run", { ...base, kind: "command", command: node.command ?? "true", env });
    }
  }

  /** What an Input Node emits: the Ticket's issue, the Run's own branch, or the value given at Start. */
  private entryValue(ctx: RunContext, type: OutputType): unknown {
    if (type === "issue") {
      if (!ctx.ticket) return undefined;
      const { number, title, body, labels, url } = ctx.ticket;
      return { number, title, body, labels, url };
    }
    const given = ctx.run.inputValue;
    if (given?.type !== type) return undefined;
    return type === "branch" ? { branch: ctx.run.branch ?? "", headCommit: null } : given.value;
  }

  private agentEnv(node: SnapshotNode): Record<string, string> {
    const outputs = activeOutputs(node.outputs, node.enabledOptionalOutputs);
    return outputs.some((o) => o.type === "branch") ? { CLAUDERON_EXPECT_COMMIT: "1" } : {};
  }

  /**
   * A person approved or answered (spec M3 §2): the web app already moved the
   * Run back to `running`. An answered Grill round resumes the same Claude
   * session on the same Attempt; otherwise the Run goes on to its next Node.
   */
  resume(runId: string): Promise<void> {
    return this.serial(async () => {
      const ctx = await getRunContext(this.opts.db, runId);
      const machineId = ctx?.run.machineId;
      if (!ctx || !machineId || ctx.run.state !== "running") return;
      const attempt = (await attemptsOfRun(this.opts.db, runId)).find((a) => !a.superseded && a.state === "running");
      if (!attempt) return this.advance(runId);
      const node = ctx.snapshot.nodes.find((n) => n.id === attempt.flowNodeId);
      if (node?.kind !== "grill") return;
      const round = await latestAnsweredRound(this.opts.db, attempt.id);
      if (!round || this.resumedRounds.has(round.id)) return;
      this.resumedRounds.add(round.id);
      if (!attempt.claudeSessionId) {
        const end = { endedAt: this.now(), exitCode: -1, claudeSessionId: null };
        return this.failAttempt(ctx, attempt.id, "No Claude session to resume", end);
      }
      const outputs = activeOutputs(node.outputs, node.enabledOptionalOutputs).map((o) => o.name);
      const answers = (round.response as { answers?: GrillAnswers } | null)?.answers ?? {};
      this.opts.links.send(machineId, "node.run", {
        attemptId: attempt.id,
        runId,
        worktreePath: ctx.run.worktreePath ?? "",
        kind: "agent",
        prompt: buildGrillAnswerPrompt((round.questions ?? []) as GrillQuestion[], answers, outputs),
        resumeSessionId: attempt.claudeSessionId,
        env: this.agentEnv(node),
      });
      this.opts.live.runChanged(runId);
    });
  }

  /** Every input's value: the Output on its edge from the latest succeeded Attempt of this pass. */
  private inputsOf(snapshot: FlowSnapshot, node: SnapshotNode, attempts: readonly AttemptWithOutputs[]) {
    const values: { name: string; type: string; value: unknown }[] = [];
    for (const input of node.inputs) {
      const edge = snapshot.edges.find((e) => e.toFlowNodeId === node.id && e.toInput === input.name);
      if (!edge) continue;
      const source = attempts.filter((a) => a.flowNodeId === edge.fromFlowNodeId && a.state === "succeeded").at(-1);
      const output = source?.outputs.find((o) => o.name === edge.fromOutput);
      if (output) values.push({ name: input.name, type: output.type, value: output.value });
    }
    return values;
  }

  /** Environment of a Command Node; `clauderon-open-pr` reads it (spec M1 §4.5). */
  private commandEnv(ctx: RunContext, inputs: readonly { name: string; value: unknown }[]): Record<string, string> {
    const env: Record<string, string> = {
      ...(ctx.ticket ? { CLAUDERON_ISSUE_NUMBER: String(ctx.ticket.number) } : {}),
      CLAUDERON_TITLE: ctx.title,
      CLAUDERON_BASE: ctx.project.baseBranch,
      CLAUDERON_BRANCH: ctx.run.branch ?? "",
    };
    for (const { name, value } of inputs) {
      if (name === "summary") env.CLAUDERON_SUMMARY = typeof value === "string" ? value : JSON.stringify(value);
      if (name === "test-result") {
        const { exitCode, tail } = value as { exitCode: number; tail: string };
        env.CLAUDERON_TEST_RESULT = `Exit code ${exitCode}\n\n${tail}`;
      }
    }
    return env;
  }

  /** A log line: masked again with the app's secrets, stored, then streamed (NFR-1, NFR-5). */
  async nodeLog(line: Payload<"node.log">): Promise<void> {
    const text = this.hide(line.text);
    if (!(await getAttempt(this.opts.db, line.attemptId))) return;
    await appendLogChunk(this.opts.db, { attemptId: line.attemptId, seq: line.seq, stream: line.stream, text, at: this.now() });
    this.opts.live.log({ attemptId: line.attemptId, seq: line.seq, stream: line.stream, text });
  }

  async nodeUsage(usage: Payload<"node.usage">): Promise<void> {
    await setAttemptUsage(this.opts.db, usage.attemptId, {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      ...(usage.cacheCreated !== undefined ? { cacheCreationTokens: usage.cacheCreated } : {}),
      ...(usage.cacheRead !== undefined ? { cacheReadTokens: usage.cacheRead } : {}),
    });
  }

  /** The per-turn summary of an Agent Node (#105). */
  async nodeTurns(payload: Payload<"node.turns">, machineId: string): Promise<void> {
    // Masked again here with the app's secrets, as a log line is (NFR-1).
    const turns = payload.turns.map((t) => ({ ...t, tool: t.tool && this.hide(t.tool), target: t.target && this.hide(scrubTarget(t.tool, t.target)) }));
    await appendAttemptTurns(this.opts.db, payload.attemptId, machineId, turns);
  }

  /** Stores the Outputs and moves on, or fails the Attempt and the Run with its reason. */
  nodeResult(result: Payload<"node.result">): Promise<void> {
    return this.serial(async () => {
      const attempt = await getAttempt(this.opts.db, result.attemptId);
      if (!attempt || attempt.state !== "running") return;
      const ctx = await getRunContext(this.opts.db, attempt.runId);
      const node = ctx?.snapshot.nodes.find((n) => n.id === attempt.flowNodeId);
      if (!ctx || !node) return;

      const end = { endedAt: this.now(), exitCode: result.exitCode, claudeSessionId: result.sessionId ?? attempt.claudeSessionId };
      const branch = { branch: ctx.run.branch ?? "", headCommit: result.headCommit ?? null };
      let outputs: OutputValue[];
      if (result.error) {
        return this.failAttempt(ctx, attempt.id, this.hide(result.error), end);
      }
      if (node.kind === "grill") {
        // Questions instead of Outputs: a new round for a person (spec M3 §2.2).
        const asked = parseGrillQuestions(result.result);
        if (asked && !asked.ok) return this.failAttempt(ctx, attempt.id, asked.reason, end);
        if (asked?.ok) {
          await askHuman(this.opts.db, { runId: ctx.run.id, attemptId: attempt.id, kind: "grill", questions: asked.questions, claudeSessionId: end.claudeSessionId, now: this.now() });
          this.opts.live.runChanged(ctx.run.id);
          return;
        }
      }
      if (node.kind === "agent" || node.kind === "grill") {
        const checked = checkAgentResult(node, node.enabledOptionalOutputs, result.result, result.headCommit ? branch : undefined);
        if (!checked.ok) return this.failAttempt(ctx, attempt.id, checked.reason, end);
        outputs = checked.outputs;
      } else {
        const facts = (result.result ?? {}) as { tail?: string; pullRequest?: { number: number; url: string } };
        outputs = commandOutputs(node.outputs, node.enabledOptionalOutputs, { exitCode: result.exitCode, tail: facts.tail ?? "", pullRequest: facts.pullRequest }, branch);
      }

      await finishAttempt(this.opts.db, attempt.id, { state: "succeeded", ...end, outputs });
      const pullRequest = outputs.find((o) => o.type === "pull-request")?.value as { number: number; url: string } | undefined;
      if (pullRequest) {
        await updateRun(this.opts.db, ctx.run.id, {
          pullRequestNumber: pullRequest.number,
          pullRequestUrl: pullRequest.url,
          pullRequestState: "open",
          pullRequestCheckedAt: this.now(),
        });
      }
      await this.advance(ctx.run.id);
    });
  }

  private async failAttempt(ctx: RunContext, attemptId: string, reason: string, end: { endedAt: Date; exitCode: number; claudeSessionId: string | null }) {
    await finishAttempt(this.opts.db, attemptId, { state: "failed", ...end, error: reason });
    await this.fail(ctx.run.id, reason);
  }

  private async fail(runId: string, reason: string): Promise<void> {
    const ctx = await getRunContext(this.opts.db, runId);
    if (!ctx?.run.machineId) return;
    if (await moveRun(this.opts.db, runId, "running", { state: "failed", endedAt: this.now(), failureReason: reason })) {
      await this.ended(runId, ctx.run.machineId);
    }
  }

  /** A Run ended: remove its worktree if it is done with it, and free its Slot for the next one (RUN-16, POD-3). */
  private async ended(runId: string, machineId: string): Promise<void> {
    this.opts.live.runChanged(runId);
    await this.cleanUp(runId);
    await this.scheduleNow(machineId);
  }

  /**
   * RUN-14: a Succeeded or Cancelled Real Run gives its worktree and local
   * branch back to the Machine; Failed and Interrupted Runs keep theirs for a
   * Retry. Sent again on each connect until the Agent says it is done.
   */
  private async cleanUp(runId: string): Promise<void> {
    const ctx = await getRunContext(this.opts.db, runId);
    if (!ctx) return;
    const { run } = ctx;
    if ((run.state !== "succeeded" && run.state !== "cancelled")) return;
    if (!run.machineId || !run.worktreePath || !run.branch) return;
    this.opts.links.send(run.machineId, "workspace.cleanup", {
      runId,
      worktreePath: run.worktreePath,
      owner: ctx.project.owner,
      repo: ctx.project.repo,
      branch: run.branch,
    });
  }

  /**
   * Interrupt Running Runs (RUN-12): they keep their worktree and wait for a
   * person; nothing is retried automatically. Returns the interrupted Attempts.
   */
  private async interrupt(runIds: readonly string[], reason: string): Promise<string[]> {
    const killed: string[] = [];
    const machines = new Set<string>();
    for (const r of await runningRuns(this.opts.db)) {
      if (!runIds.includes(r.id)) continue;
      const attempts = await interruptRun(this.opts.db, r.id, reason, this.now());
      if (!attempts) continue;
      killed.push(...attempts);
      if (r.machineId) machines.add(r.machineId);
      this.opts.live.runChanged(r.id);
    }
    // Their Slots are free now; Queued Runs start if their Machine is there.
    for (const machineId of machines) await this.scheduleNow(machineId);
    return killed;
  }

  /**
   * A Machine is gone (spec M3 §6, ADR 0006): no heartbeat for 30 s, or it
   * was paired anew. Its Running Runs become Interrupted.
   */
  machineLost(machineId: string, reason: string): Promise<void> {
    return this.serial(async () => {
      const runs = await runningRuns(this.opts.db, machineId);
      await this.interrupt(runs.map((r) => r.id), reason);
    });
  }

  /**
   * A Machine's Agent said hello (spec M3 §6). After an Agent restart or a
   * Gateway restart, its Running Runs whose Attempts are not live can
   * never report and become Interrupted. Then every live Attempt that is not
   * running in the database is killed, and Runs that lost a command go on.
   */
  machineBack(machineId: string, back: MachineBack): Promise<void> {
    return this.serial(async () => {
      const live = new Set(back.liveAttempts);
      const lost: string[] = [];
      if (back.checkLive) {
        for (const r of await runningRuns(this.opts.db, machineId)) {
          if (r.attemptIds.length > 0 ? r.attemptIds.some((id) => !live.has(id)) : r.branch !== null && r.worktreePath === null) {
            // A Node, or a Workspace being prepared, that can no longer report.
            lost.push(r.id);
          }
        }
      }
      const interrupted = await this.interrupt(lost, back.reason);
      const running = await runningAttemptIds(this.opts.db, back.liveAttempts);
      for (const attemptId of new Set([...back.liveAttempts.filter((id) => !running.has(id)), ...interrupted])) {
        this.opts.links.send(machineId, "node.kill", { attemptId });
      }
      await this.reconcile(machineId);
      // A cleanup that failed, or never arrived, is asked for again (RUN-14).
      for (const { id } of await runsToCleanUp(this.opts.db, machineId)) await this.cleanUp(id);
    });
  }

  /** Re-drives a Machine's Runs after a reconnect: a Run with no Node in flight goes on, then it schedules. */
  private async reconcile(machineId: string): Promise<void> {
    for (const r of await runningRuns(this.opts.db, machineId)) {
      if (r.attemptIds.length > 0) continue;
      const waitingForLogins = r.branch === null || (r.pendingRetry !== null && !r.pendingRetry.loginsChecked);
      if (!waitingForLogins && r.worktreePath !== null) await this.advance(r.id);
    }
    await this.scheduleNow(machineId);
  }

  private hide(text: string): string {
    return mask(text, this.opts.secrets);
  }

  private now(): Date {
    return this.opts.clock.now();
  }

  private log(message: string): void {
    (this.opts.log ?? console.warn)(message);
  }
}
