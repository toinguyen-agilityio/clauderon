import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ticketStatus } from "@clauderon/core";
import { attemptsOfRun, getRun, listTicketsWithRuns, logChunksOf, schema, sql, type Db } from "@clauderon/db";
import type { FakeHostAgent } from "@clauderon/testing";
import {
  createTestDatabase,
  memberRow,
  memorySocketPair,
  podRow,
  projectRow,
  startSampleBatch,
  ticketRow,
  type TestDatabase,
} from "@clauderon/testing";
import { startGateway } from "./harness";

let test: TestDatabase;
let db: Db;

beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
});
afterAll(() => test.drop());
beforeEach(async () => {
  await db.execute(sql`truncate member, pod, project, ticket, batch, run, attempt, output, log_chunk, audit_entry, pod_host cascade`);
});

/** A Host Agent that logs in, prepares workspaces and runs every Node successfully. */
function succeedEverything(agent: FakeHostAgent, options: { pullRequest?: boolean } = {}) {
  agent.respond("pod.checkLogins", ({ podId }, a) =>
    a.send("pod.logins", { podId, claude: true, gh: true, ghAccount: "octocat", tokenRepos: ["acme/web", "other/x"], checkedAt: new Date().toISOString() }),
  );
  agent.respond("workspace.prepare", ({ runId }, a) => a.send("workspace.ready", { runId, worktreePath: `/workspace/runs/${runId}` }));
  agent.respond("node.run", (run, a) => {
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
  });
}

async function setup(slots = 2, ticketCount = 1, extra: Parameters<typeof startGateway>[2] = {}) {
  const member = await memberRow(db, "ann@example.com", "Ann");
  const pod = await podRow(db, member.id, { slots });
  const project = await projectRow(db);
  const tickets = [];
  for (let n = 1; n <= ticketCount; n++) tickets.push(await ticketRow(db, project.id, 410 + n, { title: `Fix: Ledger totals ${n}!` }));
  const ctx = await startGateway(db, [], extra);
  return { member, pod, project, tickets, ...ctx };
}

describe("Run engine", () => {
  it("T1-11: Basic ticket delivery ends succeeded with the pull-request Output copied to the Run", async () => {
    const { member, pod, tickets, gateway, agent, clock, flush } = await setup();
    succeedEverything(agent);
    const start = await startSampleBatch(db, member, pod.id, [tickets[0]!.id], clock.now(), "Use small commits.");
    if (!start.ok) throw new Error("start failed");
    await gateway.engine.schedule(pod.id);
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

    // Login check first, then the workspace, then the Nodes in order.
    expect(agent.received.map((e) => e.type)).toEqual(["pod.checkLogins", "workspace.prepare", "node.run", "node.run", "node.run"]);
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
    const [stored] = await db.select().from(schema.pod);
    expect(stored!.ghTokenScope).toEqual({ tokenRepos: ["acme/web"] });
  });

  it("T1-13: no pull request printed: the Run succeeds and the Ticket stays Open", async () => {
    const { member, pod, tickets, gateway, agent, clock, flush } = await setup();
    succeedEverything(agent, { pullRequest: false });
    const start = await startSampleBatch(db, member, pod.id, [tickets[0]!.id], clock.now());
    await gateway.engine.schedule(pod.id);
    await flush();

    expect(await getRun(db, start.ok ? start.runIds[0]! : "")).toMatchObject({ state: "succeeded", pullRequestNumber: null });
    const [ticket] = await listTicketsWithRuns(db);
    expect(ticketStatus({ issueState: "open" }, ticket!.runs.map((r) => ({ ...r, pullRequestState: null })))).toBe("Open");
  });

  it("T1-12: an Agent result missing a required Output fails the Attempt and the Run with that reason", async () => {
    const { member, pod, tickets, gateway, agent, clock, flush } = await setup();
    succeedEverything(agent);
    agent.respond("node.run", (run, a) => a.send("node.result", { attemptId: run.attemptId, exitCode: 0, result: { outputs: {} } }));
    const start = await startSampleBatch(db, member, pod.id, [tickets[0]!.id], clock.now());
    await gateway.engine.schedule(pod.id);
    await flush();

    const runId = start.ok ? start.runIds[0]! : "";
    expect(await getRun(db, runId)).toMatchObject({ state: "failed", failureReason: "Required Output branch is missing" });
    const attempts = await attemptsOfRun(db, runId);
    expect(attempts.at(-1)).toMatchObject({ state: "failed", error: "Required Output branch is missing" });
    expect(agent.of("node.run")).toHaveLength(1);
  });

  it("a Host Agent error fails the Run with it, e.g. no commit on the branch", async () => {
    const { member, pod, tickets, gateway, agent, clock, flush } = await setup();
    succeedEverything(agent);
    agent.respond("node.run", (run, a) => a.send("node.result", { attemptId: run.attemptId, exitCode: 0, error: "no commit on the branch" }));
    const start = await startSampleBatch(db, member, pod.id, [tickets[0]!.id], clock.now());
    await gateway.engine.schedule(pod.id);
    await flush();
    expect(await getRun(db, start.ok ? start.runIds[0]! : "")).toMatchObject({ state: "failed", failureReason: "no commit on the branch" });
  });

  it("POD-5: a failed login check right before the Run fails it without starting a Node", async () => {
    const { member, pod, tickets, gateway, agent, clock, flush } = await setup();
    succeedEverything(agent);
    agent.respond("pod.checkLogins", ({ podId }, a) =>
      a.send("pod.logins", { podId, claude: true, gh: false, ghAccount: null, tokenRepos: [], checkedAt: new Date().toISOString() }),
    );
    const start = await startSampleBatch(db, member, pod.id, [tickets[0]!.id], clock.now());
    await gateway.engine.schedule(pod.id);
    await flush();
    expect(await getRun(db, start.ok ? start.runIds[0]! : "")).toMatchObject({ state: "failed", failureReason: "gh not logged in" });
    expect(agent.of("workspace.prepare")).toHaveLength(0);
  });

  it("T1-10: a Batch of 3 Tickets on a 2-Slot Pod starts 2 Runs; the third starts when one ends", async () => {
    const { member, pod, tickets, gateway, agent, clock, flush } = await setup(2, 3);
    succeedEverything(agent);
    // Hold the first Node of every Run until the test releases it.
    const held: { attemptId: string }[] = [];
    agent.respond("node.run", (run) => held.push(run));
    const start = await startSampleBatch(
      db,
      member,
      pod.id,
      tickets.map((t) => t.id),
      clock.now(),
    );
    if (!start.ok) throw new Error("start failed");
    await gateway.engine.schedule(pod.id);
    await flush();

    const states = async () => Promise.all(start.runIds.map(async (id) => (await getRun(db, id))!.state));
    expect(await states()).toEqual(["running", "running", "queued"]);

    agent.send("node.result", { attemptId: held[0]!.attemptId, exitCode: 1, error: "Command exited 1" });
    await flush();
    expect(await states()).toEqual(["failed", "running", "running"]);
  });

  it("T1-15: a log line holding ghp_… is stored and streamed masked", async () => {
    const { member, pod, tickets, gateway, agent, clock, flush } = await setup();
    succeedEverything(agent);
    const lines: string[] = [];
    agent.respond("node.run", (run, a) => {
      a.send("node.log", { attemptId: run.attemptId, seq: 0, stream: "stdout", text: "token ghp_abcdefghijklmnopqrstuvwxyz0123 and app-secret-value" });
    });
    const start = await startSampleBatch(db, member, pod.id, [tickets[0]!.id], clock.now());
    await gateway.engine.schedule(pod.id);
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

  it("a stopped Pod starts nothing until it runs again", async () => {
    const { member, pod, tickets, gateway, agent, clock, flush } = await setup();
    succeedEverything(agent);
    await db.update(schema.pod).set({ status: "stopped" });
    const start = await startSampleBatch(db, member, pod.id, [tickets[0]!.id], clock.now());
    await gateway.engine.schedule(pod.id);
    await flush();
    const runId = start.ok ? start.runIds[0]! : "";
    expect((await getRun(db, runId))!.state).toBe("queued");

    agent.send("pod.status", { podId: pod.id, status: "running", containerId: "c1", imageDigest: "sha256:1" });
    await flush();
    expect((await getRun(db, runId))!.state).toBe("succeeded");
  });
});

describe("Dry-run (spec M2 §7)", () => {
  /** Steps the fake clock until every Run has ended, checking the Slot cap each second. */
  async function runToTheEnd(db: Db, clock: { advance(ms: number): Promise<void> }, flush: () => Promise<void>, slots: number) {
    for (let second = 0; second < 400; second++) {
      const runs = await db.select().from(schema.run);
      expect(runs.filter((r) => r.state === "running").length).toBeLessThanOrEqual(slots);
      if (runs.every((r) => r.state === "succeeded" || r.state === "failed")) return;
      await clock.advance(1000);
      await flush();
    }
    throw new Error("Runs did not end");
  }

  it("T2-2: never sends workspace.prepare, node.run or a login check, and succeeds with fake Outputs", async () => {
    // random() = 0: every optional Output is made, so the pull request is there to see.
    const { member, pod, tickets, gateway, agent, clock, flush } = await setup(2, 1, { random: () => 0 });
    const start = await startSampleBatch(db, member, pod.id, [tickets[0]!.id], clock.now(), "", "dry");
    if (!start.ok) throw new Error("start failed");
    await gateway.engine.schedule(pod.id);
    await flush();
    await runToTheEnd(db, clock, flush, 2);

    expect(agent.received.map((e) => e.type)).toEqual([]);
    const run = (await getRun(db, start.runIds[0]!))!;
    expect(run).toMatchObject({ state: "succeeded", mode: "dry", branch: null });
    const attempts = await attemptsOfRun(db, run.id);
    expect(attempts.map((a) => a.state)).toEqual(["succeeded", "succeeded", "succeeded", "succeeded"]);
    expect(attempts.at(-1)!.outputs.some((o) => o.type === "pull-request")).toBe(true);
    const logs = await logChunksOf(db, attempts[1]!.id);
    expect(logs.map((l) => l.text)).toEqual(expect.arrayContaining([expect.stringContaining("[dry-run]")]));
  });

  it("T2-3: a Ticket with an Active Dry-run Run can still start a Real Run", async () => {
    const { member, pod, tickets, clock } = await setup();
    const dry = await startSampleBatch(db, member, pod.id, [tickets[0]!.id], clock.now(), "", "dry");
    expect(dry.ok).toBe(true);
    const real = await startSampleBatch(db, member, pod.id, [tickets[0]!.id], clock.now(), "", "real");
    expect(real.ok).toBe(true);
  });

  it("T2-1 (A2): 10 Tickets as a Dry-run Batch on 2 Slots never run more than 2 at once, and all succeed", async () => {
    const { member, pod, tickets, gateway, clock, flush } = await setup(2, 10);
    const start = await startSampleBatch(db, member, pod.id, tickets.map((t) => t.id), clock.now(), "", "dry");
    if (!start.ok) throw new Error("start failed");
    await gateway.engine.schedule(pod.id);
    await flush();

    const first = await db.select().from(schema.run);
    expect(first.filter((r) => r.state === "running")).toHaveLength(2);
    expect(first.filter((r) => r.state === "queued")).toHaveLength(8);

    await runToTheEnd(db, clock, flush, 2);
    const runs = await db.select().from(schema.run);
    expect(runs).toHaveLength(10);
    expect(runs.every((r) => r.state === "succeeded")).toBe(true);

    // The other 8 started in `queued_at` order (ties by id, as the scheduler does).
    const byQueue = [...runs].sort((a, b) => a.queuedAt.getTime() - b.queuedAt.getTime() || (a.id < b.id ? -1 : 1));
    const starts = byQueue.map((r) => r.startedAt!.getTime());
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    // At no moment did a later Run run before an earlier one had started: the first two start together, the rest one by one as Slots free up.
    expect(new Set(starts.slice(0, 2)).size).toBe(1);
    expect(starts[2]!).toBeGreaterThan(starts[0]!);
  });

  it("a Node fails with the configured rate, ending the Run", async () => {
    const { member, pod, tickets, gateway, clock, flush } = await setup(2, 1, { dryRunFailureRate: 1 });
    const start = await startSampleBatch(db, member, pod.id, [tickets[0]!.id], clock.now(), "", "dry");
    if (!start.ok) throw new Error("start failed");
    await gateway.engine.schedule(pod.id);
    await flush();
    await runToTheEnd(db, clock, flush, 2);
    expect(await getRun(db, start.runIds[0]!)).toMatchObject({ state: "failed", failureReason: expect.stringContaining("simulated failure") });
  });
});
