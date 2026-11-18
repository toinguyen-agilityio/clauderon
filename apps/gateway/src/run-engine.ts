import {
  activeOutputs,
  branchName,
  buildAgentPrompt,
  checkAgentResult,
  commandOutputs,
  mask,
  nextNode,
  schedule,
  simulatedDelayMs,
  simulatedOutputs,
  snapshotFlow,
  type Clock,
  type FlowSnapshot,
  type OutputValue,
  type SnapshotNode,
} from "@clauderon/core";
import {
  appendLogChunk,
  attemptsOfRun,
  createAttempt,
  finishAttempt,
  getAttempt,
  getPod,
  getRunContext,
  moveRun,
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
};

type RunContext = NonNullable<Awaited<ReturnType<typeof getRunContext>>>;

/**
 * The Run engine (spec M1 §4.2): the Gateway owns every Run; the Host Agent
 * only executes and reports. State lives in the database, so each step reads
 * it again; work is serialised so two triggers never start the same Slot.
 */
export class RunEngine {
  private queue: Promise<void> = Promise.resolve();

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

  private async waitingForLogins(podId: string) {
    return (await runsOfPod(this.opts.db, podId, ["running"])).filter((r) => r.mode === "real" && r.branch === null);
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
        else await this.prepare(run.id);
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

  /** Starts the next Node, or ends the Run when none is left (RUN-2, RUN-16). */
  private async advance(runId: string): Promise<void> {
    const ctx = await getRunContext(this.opts.db, runId);
    if (!ctx?.run.podId || ctx.run.state !== "running") return;
    const attempts = await attemptsOfRun(this.opts.db, runId);
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
      number: attempts.filter((a) => a.flowNodeId === node.id).length + 1,
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

    if (node.kind !== "agent" && node.kind !== "command") {
      const error = `${node.name}: Human Nodes arrive in M3`;
      await finishAttempt(this.opts.db, attempt.id, { state: "failed", endedAt: this.now(), error });
      return this.fail(runId, error);
    }

    if (ctx.run.mode === "dry") return this.simulate(runId, node, attempt.id);

    const inputs = this.inputsOf(ctx.snapshot, node, attempts);
    const base = { attemptId: attempt.id, runId, podId: ctx.run.podId, worktreePath: ctx.run.worktreePath ?? "" };
    if (node.kind === "agent") {
      const outputs = activeOutputs(node.outputs, node.enabledOptionalOutputs);
      const prompt = buildAgentPrompt({
        instructions: node.instructions,
        placementInstructions: node.extraInstructions,
        batchInstructions: ctx.batchInstructions,
        inputs,
        outputs: outputs.map((o) => o.name),
      });
      const env: Record<string, string> = outputs.some((o) => o.type === "branch") ? { CLAUDERON_EXPECT_COMMIT: "1" } : {};
      this.opts.link.send("node.run", { ...base, kind: "agent", prompt, env });
    } else {
      this.opts.link.send("node.run", { ...base, kind: "command", command: node.command ?? "true", env: this.commandEnv(ctx, inputs) });
    }
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

  /** Every input's value: the Output on its edge from the latest succeeded Attempt. */
  private inputsOf(snapshot: FlowSnapshot, node: SnapshotNode, attempts: readonly AttemptWithOutputs[]) {
    const values: { name: string; value: unknown }[] = [];
    for (const input of node.inputs) {
      const edge = snapshot.edges.find((e) => e.toFlowNodeId === node.id && e.toInput === input.name);
      if (!edge) continue;
      const source = attempts.filter((a) => a.flowNodeId === edge.fromFlowNodeId && a.state === "succeeded").at(-1);
      const output = source?.outputs.find((o) => o.name === edge.fromOutput);
      if (output) values.push({ name: input.name, value: output.value });
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

      const end = { endedAt: this.now(), exitCode: result.exitCode, claudeSessionId: result.sessionId ?? null };
      const branch = { branch: ctx.run.branch ?? "", headCommit: result.headCommit ?? null };
      let outputs: OutputValue[];
      if (result.error) {
        return this.failAttempt(ctx, attempt.id, this.hide(result.error), end);
      } else if (node.kind === "agent") {
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
