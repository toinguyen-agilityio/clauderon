import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FEEDBACK_HEADING, type FlowSnapshot } from "@clauderon/core";
import {
  attemptsOfRun,
  cancelRun,
  getRun,
  humanRequestsOfRun,
  logChunksOf,
  openHumanRequests,
  respondToHuman,
  retryRun,
  schema,
  sql,
  type Db,
} from "@clauderon/db";
import type { Payload } from "@clauderon/protocol";
import { createTestDatabase, machineRow, memberRow, projectRow, startSampleBatch, ticketRow, type FakeAgent, type TestDatabase } from "@clauderon/testing";
import { restartGateway, startGateway } from "./harness";

const TOKEN = "ann-machine-token";

// Spec M3 acceptance tests on the Gateway: Human Nodes, Grill rounds, Retry
// and resilience, with the fake Agent and the fake clock.

let test: TestDatabase;
let db: Db;

beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
});
afterAll(() => test.drop());
beforeEach(async () => {
  await db.execute(sql`truncate member, machine, pairing, project, ticket, batch, run, attempt, output, log_chunk, human_request, audit_entry cascade`);
});

type Script = {
  /** Grill rounds of questions before the plan. */
  grillRounds?: number;
  /** Exit code of each `Run tests` call in turn; 0 when the list runs out. */
  testExits?: number[];
  /** Don't answer node.run at all for these Node kinds, e.g. to keep a Node running. */
  hold?: (run: Payload<"node.run">) => boolean;
};

/** An Agent for *Plan and deliver*: Grill asks `grillRounds` rounds, then every Node succeeds. */
function scriptPlanAndDeliver(agent: FakeAgent, script: Script = {}) {
  let asked = 0;
  const exits = [...(script.testExits ?? [])];
  agent.respond("machine.checkLogins", (_, a) =>
    a.send("machine.logins", { claude: true, gh: true, ghAccount: "octocat", tokenRepos: [], checkedAt: new Date().toISOString() }),
  );
  agent.respond("workspace.prepare", ({ runId }, a) => a.send("workspace.ready", { runId, worktreePath: `/workspace/runs/${runId}` }));
  agent.respond("node.run", (run, a) => {
    if (script.hold?.(run)) return;
    const done = (payload: Omit<Payload<"node.result">, "attemptId">) => a.send("node.result", { attemptId: run.attemptId, ...payload });
    if (run.kind === "agent" && run.prompt?.includes('"questions"')) {
      if (asked < (script.grillRounds ?? 0)) {
        asked++;
        done({ exitCode: 0, sessionId: "sess-grill", result: { questions: [{ id: `q${asked}`, text: `Question ${asked}?` }] } });
      } else {
        done({ exitCode: 0, sessionId: "sess-grill", result: { outputs: { plan: "1. Fix totals" } } });
      }
    } else if (run.kind === "agent") {
      done({ exitCode: 0, sessionId: "sess-code", headCommit: "c0ffee", result: { outputs: { summary: "Fixed it" } } });
    } else if (run.command?.startsWith("npm test")) {
      const exitCode = exits.shift() ?? 0;
      for (let i = 0; i < 3; i++) a.send("node.log", { attemptId: run.attemptId, seq: i, stream: "stdout", text: exitCode ? `FAIL line ${i}` : `ok ${i}` });
      done({ exitCode, result: { tail: exitCode ? "FAIL" : "ok" }, headCommit: "c0ffee", ...(exitCode ? { error: `Command exited ${exitCode}` } : {}) });
    } else if (run.command === "clauderon-open-pr") {
      done({ exitCode: 0, headCommit: "c0ffee", result: { tail: "ok", pullRequest: { number: 77, url: "https://github.com/acme/web/pull/77" } } });
    } else {
      done({ exitCode: 0, headCommit: "c0ffee", result: { tail: "ok" } });
    }
  });
}

async function setup(slots = 2, ticketCount = 1) {
  const ann = await memberRow(db, "ann@example.com", "Ann");
  const bo = await memberRow(db, "bo@example.com", "Bo");
  const machine = await machineRow(db, ann.id, { slots, token: TOKEN });
  const project = await projectRow(db);
  const tickets: Awaited<ReturnType<typeof ticketRow>>[] = [];
  for (let n = 1; n <= ticketCount; n++) tickets.push(await ticketRow(db, project.id, 410 + n));
  const ctx = await startGateway(db, TOKEN);
  const start = async (ticketIndexes = [0], slug = "plan-and-deliver") => {
    const started = await startSampleBatch(db, ann, machine.id, ticketIndexes.map((i) => tickets[i]!.id), ctx.clock.now(), "", slug);
    if (!started.ok) throw new Error("start failed");
    await ctx.gateway.engine.schedule(machine.id);
    await ctx.flush();
    return started.runIds;
  };
  return { ann, bo, machine, tickets, start, ...ctx };
}

/** Each Node's state on the Run page's terms (T3-1): from its latest Attempt of the current pass. */
async function nodeStates(runId: string): Promise<Record<string, string>> {
  const run = (await getRun(db, runId))!;
  const snapshot = run.flowSnapshot as FlowSnapshot;
  const attempts = (await attemptsOfRun(db, runId)).filter((a) => !a.superseded);
  const ended = !["queued", "running", "waiting_for_human"].includes(run.state);
  return Object.fromEntries(
    snapshot.nodes.map((n) => {
      const last = attempts.filter((a) => a.flowNodeId === n.id).at(-1);
      return [n.name, last ? last.state : ended ? "not reached" : "queued"];
    }),
  );
}

async function openRequest(runId: string) {
  const open = (await openHumanRequests(db)).filter((r) => r.runId === runId);
  expect(open).toHaveLength(1);
  return open[0]!;
}

describe("Human Nodes on the Gateway (spec M3 §2)", () => {
  it("T3-1 (A4): Plan and deliver, stepped through: every Node shows the right state at each point", async () => {
    const { ann, bo, gateway, agent, flush, start } = await setup();
    scriptPlanAndDeliver(agent, { grillRounds: 1 });
    const [runId] = await start();

    // Grill asked a round of questions: the Run waits for a person.
    expect((await getRun(db, runId!))!.state).toBe("waiting_for_human");
    expect(await nodeStates(runId!)).toMatchObject({
      Ticket: "succeeded",
      "Grill a plan": "waiting_for_human",
      "Approve a plan": "queued",
      "Code a change": "queued",
    });

    const grill = await openRequest(runId!);
    expect(await respondToHuman(db, grill.request.id, ann.email, { decision: "answer", answers: { q1: "Use the ledger" } }, new Date())).toMatchObject({ ok: true });
    await gateway.engine.resume(runId!);
    await flush();

    // The plan reached Approve a plan.
    expect(await nodeStates(runId!)).toMatchObject({ "Grill a plan": "succeeded", "Approve a plan": "waiting_for_human" });
    const approvePlan = await openRequest(runId!);
    expect(approvePlan.request.questions).toEqual({ input: { name: "plan", type: "plan", value: "1. Fix totals" } });
    await respondToHuman(db, approvePlan.request.id, bo.email, { decision: "approve" }, new Date());
    await gateway.engine.resume(runId!);
    await flush();

    expect(await nodeStates(runId!)).toMatchObject({
      "Code a change": "succeeded",
      "Run tests": "succeeded",
      "Capture screenshots": "succeeded",
      "Open a pull request": "succeeded",
      "Approve the pull request": "waiting_for_human",
    });
    const approvePr = await openRequest(runId!);
    expect(approvePr.request.questions).toMatchObject({ input: { type: "pull-request", value: { number: 77 } } });
    await respondToHuman(db, approvePr.request.id, ann.email, { decision: "approve" }, new Date());
    await gateway.engine.resume(runId!);
    await flush();
    expect(await getRun(db, runId!)).toMatchObject({ state: "succeeded", pullRequestNumber: 77 });
    expect(Object.values(await nodeStates(runId!)).every((state) => state === "succeeded")).toBe(true);
  });

  it("T3-1: a Node after a failure shows not reached", async () => {
    const { ann, agent, start } = await setup();
    scriptPlanAndDeliver(agent);
    const [runId] = await start();
    const plan = await openRequest(runId!);
    await respondToHuman(db, plan.request.id, ann.email, { decision: "reject", feedback: "No." }, new Date());
    expect(await nodeStates(runId!)).toMatchObject({ "Grill a plan": "succeeded", "Approve a plan": "failed", "Code a change": "not reached" });
  });

  it("T3-2: Approve passes the plan through unchanged; Reject fails the Run and keeps the feedback", async () => {
    const { ann, gateway, agent, flush, start } = await setup(2, 2);
    scriptPlanAndDeliver(agent);
    const [first, second] = await start([0, 1]);

    const approve = await openRequest(first!);
    expect(await respondToHuman(db, approve.request.id, ann.email, { decision: "approve" }, new Date())).toMatchObject({ ok: true, decision: "approve" });
    await gateway.engine.resume(first!);
    await flush();
    const attempts = await attemptsOfRun(db, first!);
    const snapshot = (await getRun(db, first!))!.flowSnapshot as FlowSnapshot;
    const approveNode = snapshot.nodes.find((n) => n.name === "Approve a plan")!;
    const approved = attempts.find((a) => a.flowNodeId === approveNode.id)!;
    expect(approved.state).toBe("succeeded");
    expect(approved.outputs).toEqual([expect.objectContaining({ name: "plan", type: "plan", value: "1. Fix totals" })]);
    // The Code a change prompt got the plan as it was approved.
    expect(agent.of("node.run").find((r) => r.runId === first && r.prompt?.includes("## plan"))!.prompt).toContain("1. Fix totals");

    const reject = await openRequest(second!);
    expect(await respondToHuman(db, reject.request.id, ann.email, { decision: "reject", feedback: "   " }, new Date())).toMatchObject({ ok: false, reason: "invalid" });
    expect(await respondToHuman(db, reject.request.id, ann.email, { decision: "reject", feedback: "Split the change in two." }, new Date())).toMatchObject({ ok: true });
    expect(await getRun(db, second!)).toMatchObject({ state: "failed", failureReason: "Rejected at “Approve a plan”: Split the change in two." });
    const [request] = await humanRequestsOfRun(db, second!);
    expect(request).toMatchObject({ respondedByEmail: "ann@example.com", response: { decision: "reject", feedback: "Split the change in two." } });
  });

  it("T3-3: a waiting Run keeps its Slot past any amount of fake time; the second stays Queued", async () => {
    const { clock, flush, agent, start } = await setup(1, 2);
    scriptPlanAndDeliver(agent);
    const [first, second] = await start([0, 1]);
    expect((await getRun(db, first!))!.state).toBe("waiting_for_human");
    await clock.advance(6 * 3600_000);
    await flush();
    expect((await getRun(db, first!))!.state).toBe("waiting_for_human");
    expect((await getRun(db, second!))!.state).toBe("queued");
  });

  it("T3-4: Grill asks two rounds answered by two Members, then Outputs; each resume carries resumeSessionId on the same Attempt", async () => {
    const { ann, bo, gateway, agent, flush, start } = await setup();
    scriptPlanAndDeliver(agent, { grillRounds: 2 });
    const [runId] = await start();

    const round1 = await openRequest(runId!);
    expect(round1.request).toMatchObject({ kind: "grill", round: 1, questions: [{ id: "q1", text: "Question 1?" }] });
    await respondToHuman(db, round1.request.id, ann.email, { decision: "answer", answers: { q1: "Answer one" } }, new Date());
    await gateway.engine.resume(runId!);
    await flush();

    const round2 = await openRequest(runId!);
    expect(round2.request).toMatchObject({ round: 2, attemptId: round1.request.attemptId });
    await respondToHuman(db, round2.request.id, bo.email, { decision: "answer", answers: { q2: "Answer two" } }, new Date());
    await gateway.engine.resume(runId!);
    // A repeated command never runs a round twice.
    await gateway.engine.resume(runId!);
    await flush();

    const grillRuns = agent.of("node.run").filter((r) => r.attemptId === round1.request.attemptId);
    expect(grillRuns).toHaveLength(3);
    expect(grillRuns[0]!.resumeSessionId).toBeUndefined();
    expect(grillRuns[1]).toMatchObject({ resumeSessionId: "sess-grill" });
    expect(grillRuns[1]!.prompt).toContain("### Question 1?\n\nAnswer one");
    expect(grillRuns[2]).toMatchObject({ resumeSessionId: "sess-grill" });
    expect(grillRuns[2]!.prompt).toContain("Answer two");

    const rounds = await humanRequestsOfRun(db, runId!);
    const grillRounds = rounds.filter((r) => r.kind === "grill");
    expect(grillRounds.map((r) => [r.round, r.respondedByEmail, r.response])).toEqual([
      [1, "ann@example.com", { decision: "answer", answers: { q1: "Answer one" } }],
      [2, "bo@example.com", { decision: "answer", answers: { q2: "Answer two" } }],
    ]);
    // Approve a plan now waits.
    expect(rounds.filter((r) => r.kind === "approve").map((r) => r.respondedAt)).toEqual([null]);
    const attempts = await attemptsOfRun(db, runId!);
    expect(attempts.find((a) => a.id === round1.request.attemptId)).toMatchObject({ state: "succeeded", claudeSessionId: "sess-grill" });
  });

  it("an unknown Claude session fails the Grill Attempt with that reason", async () => {
    const { ann, gateway, agent, flush, start } = await setup();
    scriptPlanAndDeliver(agent, { grillRounds: 1 });
    const [runId] = await start();
    agent.respond("node.run", (run, a) =>
      a.send("node.result", { attemptId: run.attemptId, exitCode: 1, error: "Claude session sess-grill could not be resumed: No conversation found" }),
    );
    const round = await openRequest(runId!);
    await respondToHuman(db, round.request.id, ann.email, { decision: "answer", answers: { q1: "x" } }, new Date());
    await gateway.engine.resume(runId!);
    await flush();
    expect(await getRun(db, runId!)).toMatchObject({ state: "failed", failureReason: "Claude session sess-grill could not be resumed: No conversation found" });
  });
});

describe("Retry on the Gateway (spec M3 §4)", () => {
  it("T3-6: Retry from Code a change after a Reject: new Attempts, earlier ones kept, the prompt holds feedback, exit code, last lines and note", async () => {
    const { ann, bo, gateway, agent, flush, start, machine } = await setup(1, 1);
    scriptPlanAndDeliver(agent, { testExits: [0, 1] });
    const [runId] = await start();
    const respond = async (action: Parameters<typeof respondToHuman>[3]) => {
      const r = await openRequest(runId!);
      expect(await respondToHuman(db, r.request.id, bo.email, action, new Date())).toMatchObject({ ok: true });
      await gateway.engine.resume(runId!);
      await flush();
    };
    const retry = async (node: string, note = "") => {
      const snapshot = (await getRun(db, runId!))!.flowSnapshot as FlowSnapshot;
      const result = await retryRun(db, runId!, snapshot.nodes.find((n) => n.name === node)!.id, note, ann.email, new Date());
      expect(result).toMatchObject({ ok: true });
      expect((await getRun(db, runId!))!.state).toBe("queued");
      await gateway.engine.schedule(machine.id);
      await flush();
    };

    // Pass 1: the plan is approved, tests pass, the pull request is rejected.
    await respond({ decision: "approve" });
    await respond({ decision: "reject", feedback: "Keep the old API." });
    expect(await getRun(db, runId!)).toMatchObject({ state: "failed", failureReason: "Rejected at “Approve the pull request”: Keep the old API." });

    // Pass 2: retry from Code a change; Run tests now exits 1.
    await retry("Code a change");
    expect(await getRun(db, runId!)).toMatchObject({ state: "failed", failureReason: "Command exited 1" });

    // Pass 3: retry from Code a change with a note.
    const before = agent.of("node.run").length;
    const checksBefore = agent.of("machine.checkLogins").length;
    await retry("Code a change", "Check the rounding.");
    // A Real Retry runs the login check again; the worktree is kept, so no new workspace.
    expect(agent.of("machine.checkLogins").length).toBe(checksBefore + 1);
    expect(agent.of("workspace.prepare")).toHaveLength(1);
    const prompt = agent.of("node.run").slice(before).find((r) => r.kind === "agent")!.prompt!;
    expect(prompt).toContain(`## ${FEEDBACK_HEADING}\n\nKeep the old API.`);
    expect(prompt).toContain("“Run tests” failed with exit code 1: Command exited 1");
    expect(prompt).toContain("FAIL line 0\nFAIL line 1\nFAIL line 2");
    expect(prompt).toContain("Check the rounding.");

    const snapshot = (await getRun(db, runId!))!.flowSnapshot as FlowSnapshot;
    const nodeOf = (name: string) => snapshot.nodes.find((n) => n.name === name)!.id;
    const all = await attemptsOfRun(db, runId!);
    const code = all.filter((a) => a.flowNodeId === nodeOf("Code a change"));
    expect(code.map((a) => [a.number, a.superseded])).toEqual([
      [1, true],
      [2, true],
      [3, false],
    ]);
    expect(code[2]!.retryContext).toMatchObject({ feedback: "Keep the old API.", note: "Check the rounding.", failure: { node: "Run tests", exitCode: 1 } });
    // Earlier Nodes keep their single Attempt; later ones got new ones while the old stay visible.
    expect(all.filter((a) => a.flowNodeId === nodeOf("Grill a plan"))).toHaveLength(1);
    expect(all.filter((a) => a.flowNodeId === nodeOf("Run tests")).length).toBe(3);
    const failedTests = all.find((a) => a.flowNodeId === nodeOf("Run tests") && a.state === "failed")!;
    expect((await logChunksOf(db, failedTests.id)).map((l) => l.text)).toEqual(["FAIL line 0", "FAIL line 1", "FAIL line 2"]);
    // This pass got through to the pull request review again.
    expect((await getRun(db, runId!))!.state).toBe("waiting_for_human");
  });

  it("T3-6: a retried Run joins the end of its Machine's queue, behind an existing Queued Run", async () => {
    const { ann, gateway, agent, flush, start, machine } = await setup(1, 3);
    scriptPlanAndDeliver(agent);
    const [a] = await start([0]);
    const reject = await openRequest(a!);
    await respondToHuman(db, reject.request.id, ann.email, { decision: "reject", feedback: "No." }, new Date());
    await gateway.engine.schedule(machine.id);
    await flush();
    // B started in the freed Slot and waits; C queues behind it.
    const [b, c] = await start([1, 2]);
    expect((await getRun(db, b!))!.state).toBe("waiting_for_human");
    expect((await getRun(db, c!))!.state).toBe("queued");

    const snapshot = (await getRun(db, a!))!.flowSnapshot as FlowSnapshot;
    await retryRun(db, a!, snapshot.nodes.find((n) => n.name === "Approve a plan")!.id, "", ann.email, new Date(Date.now() + 1000));
    // Free B's Slot: C, queued earlier, goes first.
    const cancelled = await cancelRun(db, b!, ann.email, new Date());
    if (!cancelled.ok) throw new Error("cancel failed");
    await gateway.engine.cancelled({ machineId: machine.id, runId: b!, attemptIds: cancelled.cancelledAttemptIds });
    await flush();
    expect((await getRun(db, c!))!.state).toBe("waiting_for_human");
    expect((await getRun(db, a!))!.state).toBe("queued");
  });

  it("a Retry cannot skip the Node that failed: only it or an earlier Node", async () => {
    const { ann, agent, start } = await setup(1, 1);
    scriptPlanAndDeliver(agent);
    const [runId] = await start();
    const request = await openRequest(runId!);
    await respondToHuman(db, request.request.id, ann.email, { decision: "reject", feedback: "No." }, new Date());

    const snapshot = (await getRun(db, runId!))!.flowSnapshot as FlowSnapshot;
    const nodeOf = (name: string) => snapshot.nodes.find((n) => n.name === name)!.id;
    // Code a change comes after the rejected Approve a plan: retrying it would skip the approval.
    expect(await retryRun(db, runId!, nodeOf("Code a change"), "", ann.email, new Date())).toEqual({ ok: false, reason: "after-failure" });
    expect((await getRun(db, runId!))!.state).toBe("failed");
    expect(await retryRun(db, runId!, nodeOf("Approve a plan"), "", ann.email, new Date())).toMatchObject({ ok: true });
  });
});

describe("Interrupted and resilience (spec M3 §6)", () => {
  const holdCode = (run: Payload<"node.run">) => run.kind === "agent" && !run.prompt?.includes('"questions"');

  it("T3-9: a 20 s drop and reconnect: the Run stays running, no log line lost or duplicated", async () => {
    const { gateway, agent, clock, flush, start, reconnect, gatewaySide, machine } = await setup();
    scriptPlanAndDeliver(agent, { hold: holdCode });
    const [runId] = await start([0], "basic-ticket-delivery");
    const code = agent.of("node.run").at(-1)!;
    agent.send("node.log", { attemptId: code.attemptId, seq: 0, stream: "stdout", text: "line 0" });
    await flush();

    gatewaySide.cut();
    await flush();
    agent.send("node.log", { attemptId: code.attemptId, seq: 1, stream: "stdout", text: "line 1" });
    agent.send("node.log", { attemptId: code.attemptId, seq: 2, stream: "stdout", text: "line 2" });
    await clock.advance(20_000);
    await flush();
    expect((await getRun(db, runId!))!.state).toBe("running");

    reconnect({ liveAttempts: [code.attemptId] });
    await flush();
    agent.send("node.result", { attemptId: code.attemptId, exitCode: 0, headCommit: "c0ffee", result: { outputs: { summary: "ok" } } });
    await flush();
    expect((await logChunksOf(db, code.attemptId)).map((l) => l.seq)).toEqual([0, 1, 2]);
    expect(agent.of("node.kill")).toEqual([]);
    expect((await getRun(db, runId!))!.state).toBe("succeeded");
    expect(gateway.links.connected(machine.id)).toBe(true);
  });

  it("T3-10: 31 s without a heartbeat interrupts running Runs, keeps waiting ones, and kills their Attempts on reconnect", async () => {
    const { agent, clock, flush, start, reconnect } = await setup(2, 2);
    scriptPlanAndDeliver(agent, { hold: holdCode });
    const [running] = await start([0], "basic-ticket-delivery");
    const [waiting] = await start([1], "plan-and-deliver");
    expect((await getRun(db, waiting!))!.state).toBe("waiting_for_human");
    const code = agent.of("node.run").find((r) => r.runId === running)!;

    agent.stopBeating();
    await clock.advance(31_000);
    await flush();
    expect(await getRun(db, running!)).toMatchObject({ state: "interrupted", failureReason: "Machine unreachable" });
    expect((await attemptsOfRun(db, running!)).find((a) => a.id === code.attemptId)).toMatchObject({ state: "interrupted" });
    expect((await getRun(db, waiting!))!.state).toBe("waiting_for_human");
    // The silent socket was dropped, so the Agent says hello again.
    expect(agent.connected).toBe(false);

    reconnect({ liveAttempts: [code.attemptId] });
    agent.beatEvery(clock);
    await flush();
    expect(agent.of("node.kill")).toEqual([{ attemptId: code.attemptId }]);
    // Nothing is retried automatically.
    await clock.advance(120_000);
    await flush();
    expect((await getRun(db, running!))!.state).toBe("interrupted");
    expect(agent.of("node.run").filter((r) => r.runId === running)).toHaveLength(1);
  });

  it("an Agent restart interrupts Runs whose Attempts it no longer lists, and kills nothing it still runs", async () => {
    const { agent, flush, start, reconnect } = await setup();
    scriptPlanAndDeliver(agent, { hold: holdCode });
    const [runId] = await start([0], "basic-ticket-delivery");
    const code = agent.of("node.run").at(-1)!;
    reconnect({ processId: "fake-process-2", liveAttempts: [], lastReceivedId: agent.buffer.lastReceivedId });
    await flush();
    expect(await getRun(db, runId!)).toMatchObject({ state: "interrupted", failureReason: "Agent restarted" });
    expect(agent.of("node.kill")).toEqual([{ attemptId: code.attemptId }]);
  });

  it("ADR 0006: pairing the Machine anew closes the old Agent and interrupts its Running Runs", async () => {
    const { agent, flush, start, gateway, machine } = await setup();
    scriptPlanAndDeliver(agent, { hold: holdCode });
    const [runId] = await start([0], "basic-ticket-delivery");
    await gateway.machines.command({ type: "machine.repaired", machineId: machine.id });
    await flush();
    expect(await getRun(db, runId!)).toMatchObject({ state: "interrupted", failureReason: "The Machine was paired anew" });
    expect(agent.closeCode).toBe(4403);
    const [stored] = await db.select().from(schema.machine);
    expect(stored!.connected).toBe(false);
  });

  it("T3-11 (A5): restart the Gateway mid-Run; the Agent reconnects within 30 s listing the Attempt as live; the Run succeeds", async () => {
    const { agent, flush, start, gatewaySide } = await setup();
    scriptPlanAndDeliver(agent, { hold: holdCode });
    const [runId] = await start([0], "basic-ticket-delivery");
    const code = agent.of("node.run").at(-1)!;

    // The old Gateway goes away; its replacement boots and waits for hello.
    gatewaySide.cut();
    await flush();
    agent.respond("node.run", () => {});
    scriptPlanAndDeliver(agent);
    const next = await restartGateway(db, TOKEN, agent, [code.attemptId]);
    await next.clock.advance(20_000);
    agent.send("node.result", { attemptId: code.attemptId, exitCode: 0, headCommit: "c0ffee", result: { outputs: { summary: "ok" } } });
    await next.flush();
    expect((await getRun(db, runId!))!.state).toBe("succeeded");
    expect(agent.of("node.kill")).toEqual([]);
  });

  it("a restarted Gateway whose Agent does not list the Attempt interrupts the Run; one that never says hello does so after 30 s", async () => {
    const { agent, flush, start, gatewaySide } = await setup();
    scriptPlanAndDeliver(agent, { hold: holdCode });
    const [runId] = await start([0], "basic-ticket-delivery");
    gatewaySide.cut();
    await flush();
    await restartGateway(db, TOKEN, agent, []);
    expect(await getRun(db, runId!)).toMatchObject({ state: "interrupted", failureReason: "Lost while the Gateway restarted" });
  });

  it("a Gateway that boots without hearing from the Agent interrupts Running Runs after 30 s", async () => {
    const { agent, flush, start, gatewaySide } = await setup();
    scriptPlanAndDeliver(agent, { hold: holdCode });
    const [runId] = await start([0], "basic-ticket-delivery");
    gatewaySide.cut();
    await flush();
    const { createGateway } = await import("../src/gateway");
    const { FakeClock } = await import("@clauderon/testing");
    const clock = new FakeClock();
    const booted = createGateway({ db, clock, operators: [], sessionSecret: "s", appSecrets: [], log: () => {} });
    await booted.start();
    await clock.advance(29_000);
    await booted.engine.idle();
    expect((await getRun(db, runId!))!.state).toBe("running");
    await clock.advance(2_000);
    await booted.engine.idle();
    expect(await getRun(db, runId!)).toMatchObject({ state: "interrupted", failureReason: "Machine unreachable" });
  });
});
