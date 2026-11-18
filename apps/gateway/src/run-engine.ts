import {
  activeOutputs,
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
  simulatedDelayMs,
  simulatedOutputs,
  snapshotFlow,
  type Clock,
  type FlowSnapshot,
  type GrillAnswers,
  type GrillQuestion,
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
  getPod,
  getRunContext,
  interruptRun,
  latestAnsweredRound,
  markRetryLoginsChecked,
  moveRun,
  podsWithQueuedRuns,
  runningAttemptIds,
  runningRuns,
  runsOfPod,
  setAttemptUsage,
  updateRun,
  type AttemptWithOutputs,
  type Db,
  type Pod,
} from "@clauderon/db";
import type { MessageType, Payload } from "@clauderon/protocol";
import type { LiveHub } from "./live-hub";

export type Sender = { send<T extends MessageType>(type: T, payload: Payload<T>): unknown };

export type RunEngineOptions = {
  db: Db;
  link: Sender;
  clock: Clock;
  live: LiveHub;
  /** The app's own secrets, masked again before a log line is stored (NFR-1). */
  secrets: readonly string[];
  /** Chance that a simulated Dry-run Node fails, 0 to 1 (spec M2 §7); default 0. */
  dryRunFailureRate?: number;
  /** Source of randomness for the Dry-run runner; default `Math.random`. */
  random?: () => number;
  log?: (message: string) => void;
  /** Whether the Host Agent is connected; Queued Runs wait while it is not (spec M3 §6). */
  hostConnected?: () => boolean;
};

/** What the Gateway learned from a `hello` (spec M3 §6). */
export type HostBack = {
  liveAttempts: readonly string[];
  /** The Host Agent process changed, or this Gateway just booted: lost Attempts cannot report any more. */
  checkLive: boolean;
  /** Messages to and from the Gateway were lost too, so simulated Dry-run Nodes stopped. */
  gatewayRestarted: boolean;
  reason: string;
};

type RunContext = NonNullable<Awaited<ReturnType<typeof getRunContext>>>;

/**
 * The Run engine (spec M1 §4.2): the Gateway owns every Run; the Host Agent
 * only executes and reports. State lives in the database, so each step reads
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

  /** The Slot scheduler for one Pod (POD-3), after every change on it. */
  schedule(podId: string): Promise<void> {
    return this.serial(() => this.scheduleNow(podId));
  }

  private async scheduleNow(podId: string): Promise<void> {
    // Queued Runs wait for the Pod Host (spec M3 §6); its next hello schedules every Pod.
    if (this.opts.hostConnected && !this.opts.hostConnected()) return;
    const pod = await getPod(this.opts.db, podId);
    if (!pod) return;
    const runs = await runsOfPod(this.opts.db, podId, ["queued", "running", "waiting_for_human"]);
    for (const runId of schedule(pod, runs)) {
      const moved = await moveRun(this.opts.db, runId, "queued", { state: "running", startedAt: this.now() });
      if (!moved) continue;
      this.opts.live.runChanged(runId);
      // A Dry-run needs no logins and no Workspace (RUN-13): it starts its Nodes at once.
      if (runs.find((r) => r.id === runId)?.mode === "dry") await this.advance(runId);
    }
    // A login check right before each Run's first Node (POD-5); its answer
    // prepares the Workspace of every Run still waiting for it.
    if (runs.length > 0 && (await this.waitingForLogins(podId)).length > 0) this.opts.link.send("pod.checkLogins", { podId });
  }

  /** Real Runs waiting for their login check: new ones, and retried ones (spec M3 §4). */
  private async waitingForLogins(podId: string) {
    return (await runsOfPod(this.opts.db, podId, ["running"])).filter(
      (r) => r.mode === "real" && (r.branch === null || (r.pendingRetry !== null && !r.pendingRetry.loginsChecked)),
    );
  }

  /**
   * The web app cancelled a Run (RUN-8): it already ended the Run and its
   * Attempts, so only kill what still executes, then free the Slot.
   */
  cancelled({ podId, runId, attemptIds }: { podId: string; runId: string; attemptIds: readonly string[] }): Promise<void> {
    return this.serial(async () => {
      for (const attemptId of attemptIds) this.opts.link.send("node.kill", { attemptId });
      await this.ended(runId, podId);
    });
  }

  /** After a `pod.logins`: fail or prepare the Runs that waited for it. */
  loginsChecked(pod: Pod): Promise<void> {
    return this.serial(async () => {
      for (const run of await this.waitingForLogins(pod.id)) {
        if (!pod.claudeLoggedIn) await this.fail(run.id, "Claude Code not logged in");
        else if (!pod.ghLoggedIn) await this.fail(run.id, "gh not logged in");
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
    // Only an ended Run can have lost its Pod (POD-7); nothing drives it any more.
    if (!ctx?.run.podId) return;
    const branch = branchName(ctx.ticket.number, ctx.ticket.title, runId);
    await updateRun(this.opts.db, runId, { branch });
    this.opts.link.send("workspace.prepare", {
      runId,
      podId: ctx.run.podId,
      owner: ctx.project.owner,
      repo: ctx.project.repo,
      baseBranch: ctx.project.baseBranch,
      branch,
    });
  }

  workspaceReady({ runId, worktreePath }: Payload<"workspace.ready">): Promise<void> {
    return this.serial(async () => {
      await updateRun(this.opts.db, runId, { worktreePath });
      await this.advance(runId);
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
    if (!ctx?.run.podId || ctx.run.state !== "running") return;
    const all = await attemptsOfRun(this.opts.db, runId);
    const attempts = all.filter((a) => !a.superseded);
    if (attempts.some((a) => a.state === "running" || a.state === "waiting_for_human")) return;
    const views = attempts.map((a) => ({ flowNodeId: a.flowNodeId, state: a.state, outputs: a.outputs.map((o) => o.name) }));
    const next = nextNode(snapshotFlow(ctx.snapshot), views);

    if (next === "done") {
      if (await moveRun(this.opts.db, runId, "running", { state: "succeeded", endedAt: this.now() })) await this.ended(runId, ctx.run.podId);
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

    if (node.kind === "ticket") {
      // Not executed: it emits the issue at once (spec M1 §4.2 step 4).
      const { number, title, body, labels, url } = ctx.ticket;
      await finishAttempt(this.opts.db, attempt.id, {
        state: "succeeded",
        endedAt: this.now(),
        outputs: [{ name: "issue", type: "issue", value: { number, title, body, labels, url } }],
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

    // A Dry-run simulates Grill Nodes like Agent Nodes: no questions (RUN-13).
    if (ctx.run.mode === "dry") return this.simulate(runId, node, attempt.id);

    const retryContext = attempt.retryContext as RetryContext | null;
    const base = { attemptId: attempt.id, runId, podId: ctx.run.podId, worktreePath: ctx.run.worktreePath ?? "" };
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
      this.opts.link.send("node.run", { ...base, kind: "agent", prompt, env: this.agentEnv(node) });
    } else {
      const env = this.commandEnv(ctx, inputs);
      // The Host Agent turns it into $CLAUDERON_RETRY_CONTEXT_FILE (spec M3 §4).
      if (retryContext) env.CLAUDERON_RETRY_CONTEXT = renderRetryContext(retryContext);
      this.opts.link.send("node.run", { ...base, kind: "command", command: node.command ?? "true", env });
    }
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
      if (!ctx?.run.podId || ctx.run.state !== "running") return;
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
      this.opts.link.send("node.run", {
        attemptId: attempt.id,
        runId,
        podId: ctx.run.podId,
        worktreePath: ctx.run.worktreePath ?? "",
        kind: "agent",
        prompt: buildGrillAnswerPrompt((round.questions ?? []) as GrillQuestion[], answers, outputs),
        resumeSessionId: attempt.claudeSessionId,
        env: this.agentEnv(node),
      });
      this.opts.live.runChanged(runId);
    });
  }

  /**
   * The simulated runner (spec M2 §7): a Dry-run Node takes 2 to 8 seconds on
   * the clock, writes a few log lines, then fails with `dryRunFailureRate` or
   * produces fake Outputs. Only this executor differs from a Real Run.
   */
  private async simulate(runId: string, node: SnapshotNode, attemptId: string): Promise<void> {
    const random = this.opts.random ?? Math.random;
    for (const [seq, text] of [`[dry-run] ${node.name} started`, `[dry-run] simulating ${node.kind} Node`].entries()) {
      await this.nodeLog({ attemptId, seq, stream: "stdout", text });
    }
    this.opts.clock.setTimeout(() => {
      void this.serial(() => this.finishSimulated(runId, node, attemptId, random));
    }, simulatedDelayMs(random));
  }

  private async finishSimulated(runId: string, node: SnapshotNode, attemptId: string, random: () => number): Promise<void> {
    const attempt = await getAttempt(this.opts.db, attemptId);
    const ctx = await getRunContext(this.opts.db, runId);
    if (!attempt || attempt.state !== "running" || !ctx || ctx.run.state !== "running") return;
    const end = { endedAt: this.now(), exitCode: 0, claudeSessionId: null };
    await this.nodeLog({ attemptId, seq: 2, stream: "stdout", text: `[dry-run] ${node.name} finished` });

    if (random() < (this.opts.dryRunFailureRate ?? 0)) {
      return this.failAttempt(ctx, attemptId, `${node.name}: simulated failure`, { ...end, exitCode: 1 });
    }
    const outputs = simulatedOutputs(node.outputs, node.enabledOptionalOutputs, random, { branch: ctx.run.branch ?? "dry-run" });
    await finishAttempt(this.opts.db, attemptId, { state: "succeeded", ...end, outputs });
    await this.advance(runId);
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
      CLAUDERON_ISSUE_NUMBER: String(ctx.ticket.number),
      CLAUDERON_TITLE: ctx.ticket.title,
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
    await setAttemptUsage(this.opts.db, usage.attemptId, { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens });
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
    if (!ctx?.run.podId) return;
    if (await moveRun(this.opts.db, runId, "running", { state: "failed", endedAt: this.now(), failureReason: reason })) {
      await this.ended(runId, ctx.run.podId);
    }
  }

  /** A Run ended: free its Slot for the next one (RUN-16, POD-3). */
  private async ended(runId: string, podId: string): Promise<void> {
    this.opts.live.runChanged(runId);
    await this.scheduleNow(podId);
  }

  /**
   * Interrupt Running Runs (RUN-12): they keep their worktree and wait for a
   * person; nothing is retried automatically. Returns the interrupted Attempts.
   */
  private async interrupt(runIds: readonly string[], reason: string): Promise<string[]> {
    const killed: string[] = [];
    const pods = new Set<string>();
    for (const r of await runningRuns(this.opts.db)) {
      if (!runIds.includes(r.id)) continue;
      const attempts = await interruptRun(this.opts.db, r.id, reason, this.now());
      if (!attempts) continue;
      killed.push(...attempts);
      if (r.podId) pods.add(r.podId);
      this.opts.live.runChanged(r.id);
    }
    // Their Slots are free now; Queued Runs start if the Pod Host is there.
    for (const podId of pods) await this.scheduleNow(podId);
    return killed;
  }

  /** No heartbeat for 30 s (spec M3 §6): every Real Running Run becomes Interrupted. */
  hostLost(reason: string, includeDryRuns = false): Promise<void> {
    return this.serial(async () => {
      const runs = (await runningRuns(this.opts.db)).filter((r) => r.mode === "real" || includeDryRuns);
      await this.interrupt(runs.map((r) => r.id), reason);
    });
  }

  /** A Pod stopped or crashed (spec M3 §6): its Running Runs become Interrupted. */
  podDown(podId: string, reason: string): Promise<void> {
    return this.serial(async () => {
      const runs = await runningRuns(this.opts.db, podId);
      await this.interrupt(runs.map((r) => r.id), reason);
    });
  }

  /**
   * The Host Agent said hello (spec M3 §6). After a Host Agent restart or a
   * Gateway restart, Running Runs whose Attempts are not live can never
   * report and become Interrupted. Then every live Attempt that is not
   * running in the database is killed, and Runs that lost a command go on.
   */
  hostBack(back: HostBack): Promise<void> {
    return this.serial(async () => {
      const live = new Set(back.liveAttempts);
      const lost: string[] = [];
      if (back.checkLive) {
        for (const r of await runningRuns(this.opts.db)) {
          if (r.mode === "dry") {
            // Simulated in this Gateway: only a Gateway restart loses them.
            if (back.gatewayRestarted && r.attemptIds.length > 0) lost.push(r.id);
          } else if (r.attemptIds.length > 0 ? r.attemptIds.some((id) => !live.has(id)) : r.branch !== null && r.worktreePath === null) {
            // A Node, or a Workspace being prepared, that can no longer report.
            lost.push(r.id);
          }
        }
      }
      const interrupted = await this.interrupt(lost, back.reason);
      const running = await runningAttemptIds(this.opts.db, back.liveAttempts);
      for (const attemptId of new Set([...back.liveAttempts.filter((id) => !running.has(id)), ...interrupted])) {
        this.opts.link.send("node.kill", { attemptId });
      }
      await this.reconcile();
    });
  }

  /** Re-drives Runs after a reconnect: a Run with no Node in flight goes on; every Pod schedules. */
  private async reconcile(): Promise<void> {
    const pods = new Set(await podsWithQueuedRuns(this.opts.db));
    for (const r of await runningRuns(this.opts.db)) {
      if (r.podId) pods.add(r.podId);
      if (r.attemptIds.length > 0) continue;
      const waitingForLogins = r.mode === "real" && (r.branch === null || (r.pendingRetry !== null && !r.pendingRetry.loginsChecked));
      if (r.mode === "dry" || (!waitingForLogins && r.worktreePath !== null)) await this.advance(r.id);
    }
    for (const podId of pods) await this.scheduleNow(podId);
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
