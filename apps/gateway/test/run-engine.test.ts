import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ticketStatus, type OutputType, type RunInput } from "@clauderon/core";
import { attemptsOfRun, buildFlowSnapshot, cancelRun, getRun, listTicketsWithRuns, logChunksOf, schema, sql, startBatch, type Db } from "@clauderon/db";
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
import { startGateway } from "./harness";

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
        a.send("node.usage", { attemptId: run.attemptId, inputTokens: 100, outputTokens: 20 });
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
    expect(attempts[1]).toMatchObject({ inputTokens: 100, outputTokens: 20, claudeSessionId: "s1" });

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
    const startWithInput = async (ctx: Awaited<ReturnType<typeof setup>>, input: RunInput, output: { name: string; type: OutputType; optional: boolean }, toInput: string | null) => {
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
        { flowId, flowSnapshot, starter: ctx.member, machineId: ctx.machine.id, extraInstructions: "", ticketIds: [], direct: { projectId: ctx.project.id, title: "Do the plan", input } },
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
