import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ticketStatus, type OutputType, type RunInput } from "@clauderon/core";
import { appendAttemptTurns, attachmentsOfRun, attemptsOfRun, buildFlowSnapshot, sealAttachment, cancelRun, clearTurnTargetsBefore, getRun, listTicketsWithRuns, logChunksOf, nodeAttemptHistory, schema, sql, startBatch, type Db } from "@clauderon/db";
import type { FakeAgent } from "@clauderon/testing";
import {
  createTestDatabase,
  memberRow,
  memorySocketPair,
  machineRow,
  projectRow,
  sampleFlowId,
  startSampleBatch,
  ticketRow,
  type TestDatabase,
} from "@clauderon/testing";
import { SESSION_SECRET, startGateway } from "./harness";

const TOKEN = "ann-machine-token";

let test: TestDatabase;
let db: Db;

beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
});
afterAll(() => test.drop());
beforeEach(async () => {
  await db.execute(sql`truncate member, machine, pairing, project, ticket, batch, run, attempt, output, log_chunk, audit_entry cascade`);
});

/** An Agent that logs in, prepares workspaces and runs every Node successfully; with `hold`, each Node waits until the test calls its `finish`. */
function succeedEverything(agent: FakeAgent, options: { pullRequest?: boolean; hold?: (finish: () => void) => void } = {}) {
  agent.respond("machine.checkLogins", (_, a) =>
    a.send("machine.logins", { claude: true, gh: true, ghAccount: "octocat", tokenRepos: ["acme/web", "other/x"], checkedAt: new Date().toISOString() }),
  );
  agent.respond("workspace.prepare", ({ runId }, a) => a.send("workspace.ready", { runId, worktreePath: `/workspace/runs/${runId}` }));
  agent.respond("node.run", (run, a) => {
    const finish = () => {
      a.send("node.log", { attemptId: run.attemptId, seq: 0, stream: "stdout", text: `running ${run.kind}` });
      if (run.kind === "agent") {
        a.send("node.usage", { attemptId: run.attemptId, inputTokens: 100, outputTokens: 20, cacheCreated: 30, cacheRead: 60 });
        a.send("node.turns", { attemptId: run.attemptId, turns: [{ index: 0, calls: [{ tool: "Read", target: "a.ts", resultBytes: 400 }], newInput: 10, cacheCreated: 30, cacheRead: 60, output: 20 }] });
        a.send("node.result", { attemptId: run.attemptId, exitCode: 0, result: { outputs: { summary: "Fixed it" } }, sessionId: "s1", headCommit: "c0ffee" });
      } else if (run.command === "clauderon-open-pr") {
        const result = options.pullRequest === false ? { tail: "no changes" } : { tail: "ok", pullRequest: { number: 77, url: "https://github.com/acme/web/pull/77" } };
        a.send("node.result", { attemptId: run.attemptId, exitCode: 0, result, headCommit: "c0ffee" });
      } else {
        a.send("node.result", { attemptId: run.attemptId, exitCode: 0, result: { tail: "1 passing" }, headCommit: "c0ffee" });
      }
    };
    if (options.hold) options.hold(finish);
    else finish();
  });
}

async function setup(slots = 2, ticketCount = 1, extra: Parameters<typeof startGateway>[3] = {}) {
  const member = await memberRow(db, "ann@example.com", "Ann");
  const machine = await machineRow(db, member.id, { slots, token: TOKEN });
  const project = await projectRow(db);
  const tickets = [];
  for (let n = 1; n <= ticketCount; n++) tickets.push(await ticketRow(db, project.id, 410 + n, { title: `Fix: Ledger totals ${n}!` }));
  const ctx = await startGateway(db, TOKEN, [], extra);
  return { member, machine, project, tickets, ...ctx };
}

describe("Run engine", () => {
  it("T1-11: Basic ticket delivery ends succeeded with the pull-request Output copied to the Run", async () => {
    const { member, machine, tickets, gateway, agent, clock, flush } = await setup();
    succeedEverything(agent);
    const start = await startSampleBatch(db, member, machine.id, [tickets[0]!.id], clock.now(), "Use small commits.");
    if (!start.ok) throw new Error("start failed");
    await gateway.engine.schedule(machine.id);
    await flush();

    const run = (await getRun(db, start.runIds[0]!))!;
    expect(run).toMatchObject({
      state: "succeeded",
      pullRequestNumber: 77,
      pullRequestUrl: "https://github.com/acme/web/pull/77",
      pullRequestState: "open",
      worktreePath: `/workspace/runs/${run.id}`,
    });
    expect(run.branch).toBe(`clauderon/411-fix-ledger-totals-1-${run.id.slice(0, 6)}`);

    const attempts = await attemptsOfRun(db, run.id);
    expect(attempts.map((a) => a.state)).toEqual(["succeeded", "succeeded", "succeeded", "succeeded"]);
    expect(attempts[0]!.outputs).toEqual([expect.objectContaining({ name: "issue", value: expect.objectContaining({ number: 411 }) })]);
    expect(attempts[1]).toMatchObject({ inputTokens: 100, outputTokens: 20, cacheCreationTokens: 30, cacheReadTokens: 60, claudeSessionId: "s1" });
    expect(attempts[1]!.turns).toEqual([{ index: 0, calls: [{ tool: "Read", target: "a.ts", resultBytes: 400 }], newInput: 10, cacheCreated: 30, cacheRead: 60, output: 20 }]);
    // Nodes that are not a Claude session have no turns.
    expect(attempts[2]!.turns).toBeNull();

    // The check for the newly connected Agent, the login check before the Run, then the workspace, then the Nodes in order.
    expect(agent.received.map((e) => e.type)).toEqual(["machine.checkLogins", "machine.checkLogins", "workspace.prepare", "node.run", "node.run", "node.run", "workspace.cleanup"]);
    const [code, tests, pr] = agent.of("node.run");
    expect(code!.prompt).toContain("Use small commits.");
    expect(code!.prompt).toContain("## issue");
    expect(code!.env).toEqual({ CLAUDERON_EXPECT_COMMIT: "1" });
    expect(tests!.command).toBe("npm test --if-present || make test");
    expect(pr!.env).toMatchObject({
      CLAUDERON_ISSUE_NUMBER: "411",
      CLAUDERON_BASE: "main",
      CLAUDERON_BRANCH: run.branch,
      CLAUDERON_TITLE: "Fix: Ledger totals 1!",
      CLAUDERON_SUMMARY: "Fixed it",
      CLAUDERON_TEST_RESULT: "Exit code 0\n\n1 passing",
    });

    // Only the Projects' repositories are kept from the login check.
    const [stored] = await db.select().from(schema.machine);
    expect(stored!.ghTokenScope).toEqual({ tokenRepos: ["acme/web"] });
  });

  describe("a Run without a Ticket", () => {
    const startWithInput = async (
      ctx: Awaited<ReturnType<typeof setup>>,
      input: RunInput,
      output: { name: string; type: OutputType; optional: boolean },
      toInput: string | null,
      files: { name: string; data: string }[] = [],
    ) => {
      const flowId = await sampleFlowId(db);
      const base = (await buildFlowSnapshot(db, flowId))!;
      const entry = base.nodes.find((n) => n.kind === "input")!;
      const flowSnapshot = {
        ...base,
        nodes: base.nodes.map((n) => (n.id === entry.id ? { ...n, outputs: [output] } : n)),
        edges: base.edges.flatMap((e) => (e.fromFlowNodeId !== entry.id ? [e] : toInput ? [{ ...e, fromOutput: output.name, toInput }] : [])),
      };
      const start = await startBatch(
        db,
        { flowId, flowSnapshot, starter: ctx.member, machineId: ctx.machine.id, extraInstructions: "", ticketIds: [], direct: [{ projectId: ctx.project.id, title: "Do the plan", input, attachments: files.map((f) => sealAttachment({ name: f.name, data: Buffer.from(f.data) }, SESSION_SECRET)) }] },
        ctx.clock.now(),
      );
      if (!start.ok) throw new Error("start failed");
      await ctx.gateway.engine.schedule(ctx.machine.id);
      await ctx.flush();
      return (await getRun(db, start.runIds[0]!))!;
    };

    it("feeds a plan Input to the next Node and opens the pull request without an issue", async () => {
      const ctx = await setup();
      succeedEverything(ctx.agent);
      const run = await startWithInput(ctx, { type: "plan", value: "Add a retry" }, { name: "plan", type: "plan", optional: false }, "plan");
      expect(run.state).toBe("succeeded");
      expect(run.branch).toBe(`clauderon/run-do-the-plan-${run.id.slice(0, 6)}`);
      const [code, , pr] = ctx.agent.of("node.run");
      expect(code!.prompt).toContain("## plan\n\nAdd a retry");
      expect(pr!.env).toMatchObject({ CLAUDERON_TITLE: "Do the plan", CLAUDERON_BASE: "main" });
      expect(pr!.env).not.toHaveProperty("CLAUDERON_ISSUE_NUMBER");
    });

    describe("with attached files (ADR 0011)", () => {
      const plan = { type: "plan", value: "Read the spec" } as const;
      const planOutput = { name: "plan", type: "plan", optional: false } as const;
      const files = [{ name: "spec.pdf", data: "%PDF" }];
      const agentVersion = (version: string) => db.update(schema.machine).set({ agentVersion: version });

      it("names the files in the Workspace, clears their contents once delivered and has each Node check them", async () => {
        const ctx = await setup();
        await agentVersion("0.6.0+abc");
        succeedEverything(ctx.agent);
        ctx.agent.respond("workspace.prepare", ({ runId, attachments }, a) => a.send("workspace.ready", { runId, worktreePath: `/w/${runId}`, attachments: attachments?.length }));
        const run = await startWithInput(ctx, plan, planOutput, "plan", files);

        expect(run.state).toBe("succeeded");
        const [stored] = await attachmentsOfRun(db, run.id);
        expect(stored).toMatchObject({ name: "spec.pdf", size: 4, delivered: true });
        const [prepare] = ctx.agent.of("workspace.prepare");
        expect(prepare!.attachments).toEqual([{ id: stored!.id, name: "spec.pdf", size: 4, sha256: stored!.sha256 }]);
        for (const node of ctx.agent.of("node.run")) expect(node.attachments).toEqual([{ name: "spec.pdf", sha256: stored!.sha256 }]);
        const [row] = await db.select().from(schema.runAttachment);
        expect(row!.sealed).toBeNull();
      });

      it("fails the Run when its Agent is too old to download them", async () => {
        const ctx = await setup();
        await agentVersion("0.5.0+abc");
        succeedEverything(ctx.agent);
        const run = await startWithInput(ctx, plan, planOutput, "plan", files);
        expect(run).toMatchObject({ state: "failed", failureReason: expect.stringContaining("Update the Agent on your Machine") });
        expect(ctx.agent.of("workspace.prepare")).toHaveLength(0);
        expect((await attachmentsOfRun(db, run.id))[0]!.delivered).toBe(false);
      });

      it("fails the Run when the Agent did not write every file", async () => {
        const ctx = await setup();
        await agentVersion("0.6.0+abc");
        succeedEverything(ctx.agent);
        const run = await startWithInput(ctx, plan, planOutput, "plan", files);
        expect(run).toMatchObject({ state: "failed", failureReason: "Workspace: the attached files did not reach your Machine." });
        expect(ctx.agent.of("node.run")).toHaveLength(0);
      });
    });

    it("makes the Run's own branch from a branch Input", async () => {
      const ctx = await setup();
      succeedEverything(ctx.agent);
      const run = await startWithInput(ctx, { type: "branch", value: { branch: "feat/x" } }, { name: "branch", type: "branch", optional: false }, null);
      const [prepare] = ctx.agent.of("workspace.prepare");
      expect(prepare).toMatchObject({ baseBranch: "feat/x", branch: run.branch });
      expect(run.branch).not.toBe("feat/x");
    });

    it("fails the Run when an issue Input has no Ticket", async () => {
      const ctx = await setup();
      succeedEverything(ctx.agent);
      const run = await startWithInput(ctx, { type: "plan", value: "x" }, { name: "issue", type: "issue", optional: false }, "issue");
      expect(run.state).toBe("failed");
      expect(ctx.agent.of("node.run")).toHaveLength(0);
    });
  });

  it("T1-13: no pull request printed: the Run succeeds and the Ticket stays Open", async () => {
    const { member, machine, tickets, gateway, agent, clock, flush } = await setup();
    succeedEverything(agent, { pullRequest: false });
    const start = await startSampleBatch(db, member, machine.id, [tickets[0]!.id], clock.now());
    await gateway.engine.schedule(machine.id);
    await flush();

    expect(await getRun(db, start.ok ? start.runIds[0]! : "")).toMatchObject({ state: "succeeded", pullRequestNumber: null });
    const [ticket] = await listTicketsWithRuns(db);
    expect(ticketStatus({ issueState: "open" }, ticket!.runs.map((r) => ({ ...r, pullRequestState: null })))).toBe("Open");
  });

  it("T1-12: an Agent result missing a required Output fails the Attempt and the Run with that reason", async () => {
    const { member, machine, tickets, gateway, agent, clock, flush } = await setup();
    succeedEverything(agent);
    agent.respond("node.run", (run, a) => a.send("node.result", { attemptId: run.attemptId, exitCode: 0, result: { outputs: {} } }));
    const start = await startSampleBatch(db, member, machine.id, [tickets[0]!.id], clock.now());
    await gateway.engine.schedule(machine.id);
    await flush();

    const runId = start.ok ? start.runIds[0]! : "";
    expect(await getRun(db, runId)).toMatchObject({ state: "failed", failureReason: "Required Output branch is missing" });
    const attempts = await attemptsOfRun(db, runId);
    expect(attempts.at(-1)).toMatchObject({ state: "failed", error: "Required Output branch is missing" });
    expect(agent.of("node.run")).toHaveLength(1);
  });

  it("an Agent error fails the Run with it, e.g. no commit on the branch", async () => {
    const { member, machine, tickets, gateway, agent, clock, flush } = await setup();
    succeedEverything(agent);
    agent.respond("node.run", (run, a) => a.send("node.result", { attemptId: run.attemptId, exitCode: 0, error: "no commit on the branch" }));
    const start = await startSampleBatch(db, member, machine.id, [tickets[0]!.id], clock.now());
    await gateway.engine.schedule(machine.id);
    await flush();
    expect(await getRun(db, start.ok ? start.runIds[0]! : "")).toMatchObject({ state: "failed", failureReason: "no commit on the branch" });
  });

  it("POD-5: a failed login check right before the Run fails it without starting a Node", async () => {
    const { member, machine, tickets, gateway, agent, clock, flush } = await setup();
    succeedEverything(agent);
    agent.respond("machine.checkLogins", (_, a) =>
      a.send("machine.logins", { claude: true, gh: false, ghAccount: null, tokenRepos: [], checkedAt: new Date().toISOString() }),
    );
    const start = await startSampleBatch(db, member, machine.id, [tickets[0]!.id], clock.now());
    await gateway.engine.schedule(machine.id);
    await flush();
    expect(await getRun(db, start.ok ? start.runIds[0]! : "")).toMatchObject({ state: "failed", failureReason: "gh not logged in" });
    expect(agent.of("workspace.prepare")).toHaveLength(0);
  });

  it("T1-10: a Batch of 3 Tickets on a 2-Slot Machine starts 2 Runs; the third starts when one ends", async () => {
    const { member, machine, tickets, gateway, agent, clock, flush } = await setup(2, 3);
    succeedEverything(agent);
    // Hold the first Node of every Run until the test releases it.
    const held: { attemptId: string }[] = [];
    agent.respond("node.run", (run) => held.push(run));
    const start = await startSampleBatch(
      db,
      member,
      machine.id,
      tickets.map((t) => t.id),
      clock.now(),
    );
    if (!start.ok) throw new Error("start failed");
    await gateway.engine.schedule(machine.id);
    await flush();

    const states = async () => Promise.all(start.runIds.map(async (id) => (await getRun(db, id))!.state));
    expect(await states()).toEqual(["running", "running", "queued"]);

    agent.send("node.result", { attemptId: held[0]!.attemptId, exitCode: 1, error: "Command exited 1" });
    await flush();
    expect(await states()).toEqual(["failed", "running", "running"]);
  });

  it("T1-15: a log line holding ghp_… is stored and streamed masked", async () => {
    const { member, machine, tickets, gateway, agent, clock, flush } = await setup();
    succeedEverything(agent);
    const lines: string[] = [];
    agent.respond("node.run", (run, a) => {
      a.send("node.log", { attemptId: run.attemptId, seq: 0, stream: "stdout", text: "token ghp_abcdefghijklmnopqrstuvwxyz0123 and app-secret-value" });
    });
    const start = await startSampleBatch(db, member, machine.id, [tickets[0]!.id], clock.now());
    await gateway.engine.schedule(machine.id);
    await flush();
    const runId = start.ok ? start.runIds[0]! : "";
    const attempt = (await attemptsOfRun(db, runId)).at(-1)!;

    // A browser subscribed after the line was stored gets it backfilled.
    const [browser, server] = memorySocketPair();
    browser.onMessage((text) => lines.push(JSON.parse(text).text));
    await gateway.live.handle(server, JSON.stringify({ type: "subscribe.log", attemptId: attempt.id }));
    agent.send("node.log", { attemptId: attempt.id, seq: 1, stream: "stdout", text: "again ghp_abcdefghijklmnopqrstuvwxyz0123" });
    await flush();

    expect((await logChunksOf(db, attempt.id)).map((c) => c.text)).toEqual(["token ••• and •••", "again •••"]);
    expect(lines).toEqual(["token ••• and •••", "again •••"]);
  });

  it("a disconnected Machine starts nothing until its Agent says hello again", async () => {
    const { member, machine, tickets, gateway, agent, clock, flush, gatewaySide, reconnect } = await setup();
    succeedEverything(agent);
    gatewaySide.cut();
    await flush();
    const start = await startSampleBatch(db, member, machine.id, [tickets[0]!.id], clock.now());
    await gateway.engine.schedule(machine.id);
    await flush();
    const runId = start.ok ? start.runIds[0]! : "";
    expect((await getRun(db, runId))!.state).toBe("queued");

    reconnect();
    await flush();
    expect((await getRun(db, runId))!.state).toBe("succeeded");
  });
});

describe("Logins (POD-5)", () => {
  it("a new Agent process gets a login check at hello; a reconnect of the same process does not", async () => {
    const { agent, flush, gatewaySide, reconnect } = await setup();
    expect(agent.of("machine.checkLogins")).toHaveLength(1);

    gatewaySide.cut();
    await flush();
    reconnect();
    await flush();
    expect(agent.of("machine.checkLogins")).toHaveLength(1);
  });
});

describe("Cancel (RUN-8, spec M3 §5)", () => {
  it("T3-8: cancelling a running Run ends it at once, sends node.kill and frees the Slot; a late result is ignored", async () => {
    const { member, machine, tickets, gateway, agent, clock, flush } = await setup(1, 2);
    succeedEverything(agent);
    const held: { attemptId: string }[] = [];
    agent.respond("node.run", (run) => held.push(run));
    const start = await startSampleBatch(db, member, machine.id, tickets.map((t) => t.id), clock.now());
    if (!start.ok) throw new Error("start failed");
    await gateway.engine.schedule(machine.id);
    await flush();
    const [first, second] = start.runIds as [string, string];
    expect((await getRun(db, second))!.state).toBe("queued");

    const cancelled = await cancelRun(db, first, member.email, clock.now());
    if (!cancelled.ok) throw new Error("cancel failed");
    expect(cancelled.cancelledAttemptIds).toEqual([held[0]!.attemptId]);
    expect((await getRun(db, first))!.state).toBe("cancelled");

    await gateway.machines.command({ type: "run.cancel", machineId: machine.id, runId: first, attemptIds: cancelled.cancelledAttemptIds });
    await flush();
    expect(agent.of("node.kill")).toEqual([{ attemptId: held[0]!.attemptId }]);
    expect((await getRun(db, second))!.state).toBe("running");

    // The killed Node reports back late: nothing moves.
    agent.send("node.result", { attemptId: held[0]!.attemptId, exitCode: 143, error: "Command exited 143" });
    await flush();
    expect(await getRun(db, first)).toMatchObject({ state: "cancelled", failureReason: null });
    expect((await attemptsOfRun(db, first)).at(-1)).toMatchObject({ state: "cancelled" });
    const [audit] = await db.select().from(schema.auditEntry).where(sql`action = 'run.cancel'`);
    expect(audit).toMatchObject({ actorEmail: member.email, subjectId: first, detail: { from: "running" } });
  });

  it("T3-8: queued and failed Runs end cancelled; an ended Run cannot be cancelled", async () => {
    const { member, machine, tickets, gateway, agent, clock, flush } = await setup(1, 2);
    succeedEverything(agent);
    agent.respond("node.run", (run, a) => a.send("node.result", { attemptId: run.attemptId, exitCode: 1, error: "Command exited 1" }));
    const start = await startSampleBatch(db, member, machine.id, tickets.map((t) => t.id), clock.now());
    if (!start.ok) throw new Error("start failed");
    const [queued, failing] = start.runIds as [string, string];

    expect(await cancelRun(db, queued, member.email, clock.now())).toMatchObject({ ok: true, from: "queued", cancelledAttemptIds: [] });
    await gateway.engine.schedule(machine.id);
    await flush();
    expect((await getRun(db, failing))!.state).toBe("failed");

    expect(await cancelRun(db, failing, member.email, clock.now())).toMatchObject({ ok: true, from: "failed" });
    expect((await getRun(db, failing))!.state).toBe("cancelled");
    expect(await cancelRun(db, failing, member.email, clock.now())).toEqual({ ok: false, reason: "ended" });
    expect(await cancelRun(db, "00000000-0000-0000-0000-000000000000", member.email, clock.now())).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("Worktree cleanup (RUN-14, T4-7)", () => {
  it("T4-7: a Succeeded Run sends workspace.cleanup once; the Agent's answer clears the worktree and it is not asked again", async () => {
    const { member, machine, tickets, gateway, agent, clock, flush, gatewaySide, reconnect } = await setup();
    succeedEverything(agent);
    const start = await startSampleBatch(db, member, machine.id, [tickets[0]!.id], clock.now());
    if (!start.ok) throw new Error("start failed");
    await gateway.engine.schedule(machine.id);
    await flush();

    const run = (await getRun(db, start.runIds[0]!))!;
    expect(run.state).toBe("succeeded");
    expect(agent.of("workspace.cleanup")).toEqual([
      { runId: run.id, worktreePath: `/workspace/runs/${run.id}`, owner: "acme", repo: "web", branch: run.branch },
    ]);
    expect(agent.received.at(-1)!.type).toBe("workspace.cleanup");

    agent.send("workspace.cleaned", { runId: run.id });
    await flush();
    expect(await getRun(db, run.id)).toMatchObject({ state: "succeeded", worktreePath: null, branch: run.branch });

    gatewaySide.cut();
    await flush();
    reconnect();
    await flush();
    expect(agent.of("workspace.cleanup")).toHaveLength(1);
  });

  it("T4-7: a cleanup the Agent never answered is sent again when it next connects", async () => {
    const { member, machine, tickets, gateway, agent, clock, flush, gatewaySide, reconnect } = await setup();
    succeedEverything(agent);
    const start = await startSampleBatch(db, member, machine.id, [tickets[0]!.id], clock.now());
    if (!start.ok) throw new Error("start failed");
    await gateway.engine.schedule(machine.id);
    await flush();
    expect(agent.of("workspace.cleanup")).toHaveLength(1);

    gatewaySide.cut();
    await flush();
    reconnect();
    await flush();
    expect(agent.of("workspace.cleanup")).toHaveLength(2);
    expect(agent.of("workspace.cleanup")[1]).toEqual(agent.of("workspace.cleanup")[0]);
  });

  it("T4-7: a Cancelled Run sends workspace.cleanup; a Failed Run keeps its worktree, also across a reconnect", async () => {
    const { member, machine, tickets, gateway, agent, clock, flush, gatewaySide, reconnect } = await setup(2, 2);
    succeedEverything(agent);
    const nodes: { attemptId: string }[] = [];
    agent.respond("node.run", (run, a) => {
      nodes.push(run);
      if (nodes.length > 1) a.send("node.result", { attemptId: run.attemptId, exitCode: 1, error: "Command exited 1" });
    });
    const start = await startSampleBatch(db, member, machine.id, tickets.map((t) => t.id), clock.now());
    if (!start.ok) throw new Error("start failed");
    const [first, second] = start.runIds as [string, string];
    await gateway.engine.schedule(machine.id);
    await flush();
    expect((await getRun(db, second))!.state).toBe("failed");
    expect(agent.of("workspace.cleanup")).toEqual([]);

    const cancelled = await cancelRun(db, first, member.email, clock.now());
    if (!cancelled.ok) throw new Error("cancel failed");
    await gateway.machines.command({ type: "run.cancel", machineId: machine.id, runId: first, attemptIds: cancelled.cancelledAttemptIds });
    await flush();
    expect(agent.of("workspace.cleanup").map((c) => c.runId)).toEqual([first]);

    gatewaySide.cut();
    await flush();
    reconnect();
    await flush();
    expect(agent.of("workspace.cleanup").map((c) => c.runId)).toEqual([first, first]);
    expect((await getRun(db, second))!.worktreePath).toBe(`/workspace/runs/${second}`);
  });

  it("T4-7: a Machine with no ended Runs is sent no cleanup", async () => {
    const { gateway, agent, flush, machine } = await setup();
    await gateway.engine.schedule(machine.id);
    await flush();
    expect(agent.of("workspace.cleanup")).toEqual([]);
  });
});

describe("Queue and Slots (A2)", () => {
  it("T2-1 (A2): 10 Tickets on 2 Slots never run more than 2 at once, start first in, first out, and all succeed", async () => {
    const { member, machine, tickets, gateway, agent, clock, flush } = await setup(2, 10);
    // A fake Agent that holds every Node until the test lets it finish, so the Slots stay busy.
    const held: (() => void)[] = [];
    succeedEverything(agent, { hold: (finish) => held.push(finish) });
    const start = await startSampleBatch(db, member, machine.id, tickets.map((t) => t.id), clock.now(), "");
    if (!start.ok) throw new Error("start failed");
    await gateway.engine.schedule(machine.id);
    await flush();

    const first = await db.select().from(schema.run);
    expect(first.filter((r) => r.state === "running")).toHaveLength(2);
    expect(first.filter((r) => r.state === "queued")).toHaveLength(8);

    for (let step = 0; step < 200 && held.length > 0; step++) {
      held.shift()!();
      await clock.advance(1000);
      await flush();
      const runs = await db.select().from(schema.run);
      expect(runs.filter((r) => r.state === "running").length).toBeLessThanOrEqual(2);
    }
    const runs = await db.select().from(schema.run);
    expect(runs).toHaveLength(10);
    expect(runs.every((r) => r.state === "succeeded")).toBe(true);

    // The other 8 started in `queued_at` order (ties by id, as the scheduler does).
    const byQueue = [...runs].sort((a, b) => a.queuedAt.getTime() - b.queuedAt.getTime() || (a.id < b.id ? -1 : 1));
    const starts = byQueue.map((r) => r.startedAt!.getTime());
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    // The first two start together, the rest one by one as Slots free up.
    expect(new Set(starts.slice(0, 2)).size).toBe(1);
    expect(starts[2]!).toBeGreaterThan(starts[0]!);
  });
});

describe("Node inspector data (#105)", () => {
  it("adds the turns of each Claude call to one list, numbered in order, only from the Attempt's own Machine while it runs", async () => {
    const { member, machine, tickets, gateway, agent, clock, flush } = await setup();
    let finishNode: (() => void) | undefined;
    succeedEverything(agent, { hold: (finish) => (finishNode = finish) });
    const start = await startSampleBatch(db, member, machine.id, [tickets[0]!.id], clock.now(), "");
    if (!start.ok) throw new Error("start failed");
    await gateway.engine.schedule(machine.id);
    await flush();
    // The first held Node is the Ticket's Issue Node or the Agent Node; walk until the Agent Node runs.
    while (!(await attemptsOfRun(db, start.runIds[0]!)).some((a) => a.state === "running" && agent.of("node.run").at(-1)?.kind === "agent")) {
      finishNode?.();
      await flush();
    }
    const running = (await attemptsOfRun(db, start.runIds[0]!)).find((a) => a.state === "running")!;
    const one = { index: 0, calls: [{ tool: "Read", target: "a.ts", resultBytes: null }], newInput: 1, cacheCreated: 2, cacheRead: 3, output: 4 };

    expect(await appendAttemptTurns(db, running.id, "00000000-0000-4000-8000-000000000000", [one])).toBe(false);
    expect(await appendAttemptTurns(db, running.id, machine.id, [one])).toBe(true);
    expect(await appendAttemptTurns(db, running.id, machine.id, [one, one])).toBe(true);
    const after = (await attemptsOfRun(db, start.runIds[0]!)).find((a) => a.id === running.id)!;
    expect(after.turns!.map((t) => t.index)).toEqual([0, 1, 2]);

    // An Attempt that has ended takes no more.
    finishNode?.();
    await flush();
    expect(await appendAttemptTurns(db, running.id, machine.id, [one])).toBe(false);
  });

  it("an older Agent that sends no split or turns leaves them empty, with totals still stored", async () => {
    const { member, machine, tickets, gateway, agent, clock, flush } = await setup();
    succeedEverything(agent);
    agent.respond("node.run", (run, a) => {
      if (run.kind === "agent") {
        a.send("node.usage", { attemptId: run.attemptId, inputTokens: 50, outputTokens: 5 });
        a.send("node.result", { attemptId: run.attemptId, exitCode: 0, result: { outputs: { summary: "ok" } }, headCommit: "c0ffee" });
      } else a.send("node.result", { attemptId: run.attemptId, exitCode: 0, result: { tail: "ok" }, headCommit: "c0ffee" });
    });
    const start = await startSampleBatch(db, member, machine.id, [tickets[0]!.id], clock.now(), "");
    if (!start.ok) throw new Error("start failed");
    await gateway.engine.schedule(machine.id);
    await flush();

    const attempt = (await attemptsOfRun(db, start.runIds[0]!))[1]!;
    expect(attempt).toMatchObject({ inputTokens: 50, outputTokens: 5, cacheCreationTokens: null, cacheReadTokens: null, turns: null });
  });

  it("lists the same Node's finished Attempts in other Runs of the Flow, without the current Run", async () => {
    const { member, machine, tickets, gateway, agent, clock, flush } = await setup(2, 2);
    succeedEverything(agent);
    const start = await startSampleBatch(db, member, machine.id, tickets.map((t) => t.id), clock.now(), "");
    if (!start.ok) throw new Error("start failed");
    await gateway.engine.schedule(machine.id);
    await flush();

    const [first, second] = start.runIds as [string, string];
    const run = (await getRun(db, second))!;
    const code = (await attemptsOfRun(db, second)).find((a) => a.turns)!;
    const history = await nodeAttemptHistory(db, run.flowId!, code.flowNodeId, second);
    expect(history.map((h) => h.runId)).toEqual([first]);
    expect(history[0]!.turns).toHaveLength(1);

    // An Attempt without turns (an older Agent, or from before the Inspector) is left out, not shown as zeros.
    await db.update(schema.attempt).set({ turns: null }).where(sql`${schema.attempt.runId} = ${first}`);
    expect(await nodeAttemptHistory(db, run.flowId!, code.flowNodeId, second)).toEqual([]);
  });
});

describe("Retention of Inspector turns (#105, NFR-5)", () => {
  it("clears the targets of old Attempts but keeps tools and sizes, and leaves recent ones alone", async () => {
    const { member, machine, tickets, gateway, agent, clock, flush } = await setup();
    succeedEverything(agent);
    const start = await startSampleBatch(db, member, machine.id, [tickets[0]!.id], clock.now(), "");
    if (!start.ok) throw new Error("start failed");
    await gateway.engine.schedule(machine.id);
    await flush();
    const code = (await attemptsOfRun(db, start.runIds[0]!)).find((a) => a.turns)!;

    expect(await clearTurnTargetsBefore(db, new Date(clock.now().getTime() - 86_400_000))).toBe(0);
    expect(await clearTurnTargetsBefore(db, new Date(clock.now().getTime() + 86_400_000))).toBe(1);
    const after = (await attemptsOfRun(db, start.runIds[0]!)).find((a) => a.id === code.id)!;
    expect(after.turns).toEqual([{ index: 0, calls: [{ tool: "Read", target: null, resultBytes: 400 }], newInput: 10, cacheCreated: 30, cacheRead: 60, output: 20 }]);
    // Already cleared: nothing left to do.
    expect(await clearTurnTargetsBefore(db, new Date(clock.now().getTime() + 86_400_000))).toBe(0);
  });
});
