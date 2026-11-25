import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FlowSnapshot } from "@clauderon/core";
import {
  askHuman,
  createAttempt,
  flowLocks,
  getRun,
  createPairing,
  hashToken,
  machineRunCounts,
  schema,
  sql,
  type Db,
  type GatewayCommand,
} from "@clauderon/db";
import {
  FakeClock,
  FakeGitHub,
  createTestDatabase,
  memberRow,
  machineRow,
  projectRow,
  startSampleBatch,
  ticketRow,
  type TestDatabase,
} from "@clauderon/testing";
import { addToAllowlist } from "../src/server/access";
import type { AppDeps } from "../src/server/deps";
import { cloneMyFlow, deleteMyFlow, editorData, saveMyFlow } from "../src/server/flows";
import { createMyNode, deleteMyNode, updateMyNode } from "../src/server/library";
import { approveMyPairing, removeMachine, setMyMachineSettings, unpairMyMachine } from "../src/server/machines";
import { removeMember } from "../src/server/members";
import { cancelRunAs, needsYouCount, respondAs, retryAs, viewAudit, viewNeedsYou, viewRun } from "../src/server/runs";
import { startRuns } from "../src/server/start";

// Spec M3 on the web side: responses, Needs you, Retry, Cancel and the audit log.

let test: TestDatabase;
let db: Db;
let deps: AppDeps;
let clock: FakeClock;
let commands: GatewayCommand[];

beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
});
afterAll(() => test.drop());
beforeEach(async () => {
  await db.execute(sql`truncate member, machine, pairing, project, ticket, batch, run, attempt, output, log_chunk, human_request, audit_entry, flow, node cascade`);
  commands = [];
  clock = new FakeClock();
  deps = {
    db,
    operators: ["op@example.com"],
    clock,
    publish: () => {},
    command: async (c) => void commands.push(c),
    github: new FakeGitHub(),
  };
});

const audit = async () => db.select().from(schema.auditEntry);

/** The `member.notify` the web app publishes when Bo acts on Ann's Run (#198). */
const notifyAnn = (kind: string, runId: string, flowNodeId?: string) => ({
  type: "member.notify",
  memberEmail: "ann@example.com",
  kind,
  runId,
  actorEmail: "bo@example.com",
  ...(flowNodeId ? { flowNodeId } : {}),
});

async function fixture(ticketCount = 1, slots = 2) {
  const ann = await memberRow(db, "ann@example.com", "Ann");
  const bo = await memberRow(db, "bo@example.com", "Bo");
  const machine = await machineRow(db, ann.id, { slots });
  const project = await projectRow(db);
  const tickets = [];
  for (let n = 1; n <= ticketCount; n++) tickets.push(await ticketRow(db, project.id, n, { title: `Ticket ${n}` }));
  return { ann, bo, machine, project, tickets };
}

/** A queued Run of *Plan and deliver*. */
async function planRun(f: Awaited<ReturnType<typeof fixture>>, ticketIndex = 0) {
  const started = await startSampleBatch(db, f.ann, f.machine.id, [f.tickets[ticketIndex]!.id], clock.now(), "", "plan-and-deliver");
  if (!started.ok) throw new Error("start failed");
  const runId = started.runIds[0]!;
  const snapshot = (await getRun(db, runId))!.flowSnapshot as FlowSnapshot;
  const nodeId = (name: string) => snapshot.nodes.find((n) => n.name === name)!.id;
  return { runId, snapshot, nodeId };
}

/** Moves a Run to a Human Node as the Gateway does: running, an Attempt, a request. */
async function waitAt(runId: string, flowNodeId: string, kind: "approve" | "grill") {
  await db.update(schema.run).set({ state: "running", startedAt: clock.now() }).where(sql`${schema.run.id} = ${runId}`);
  const attempt = await createAttempt(db, { runId, flowNodeId, number: 1, startedAt: clock.now() });
  const questions =
    kind === "approve"
      ? { input: { name: "plan", type: "plan", value: "1. Fix totals" } }
      : [
          { id: "q1", text: "Which endpoint?" },
          { id: "q2", text: "Keep the old API?" },
        ];
  await askHuman(db, { runId, attemptId: attempt.id, kind, questions, claudeSessionId: kind === "grill" ? "sess-1" : undefined, now: clock.now() });
  const [request] = await db.select().from(schema.humanRequest).where(sql`${schema.humanRequest.attemptId} = ${attempt.id}`);
  return { attempt, request: request! };
}

describe("Approve and Reject (spec M3 §2.1)", () => {
  it("T3-2: Approve passes the input through as the Output, the Run continues and the Gateway is told; audited", async () => {
    const f = await fixture();
    const { runId, nodeId } = await planRun(f);
    const { attempt, request } = await waitAt(runId, nodeId("Approve a plan"), "approve");

    expect(await respondAs(deps, f.bo, request.id, { decision: "approve" })).toEqual({ ok: true });
    expect((await getRun(db, runId))!.state).toBe("running");
    const [a] = await db.select().from(schema.attempt).where(sql`${schema.attempt.id} = ${attempt.id}`);
    expect(a).toMatchObject({ state: "succeeded" });
    const outputs = await db.select().from(schema.output);
    expect(outputs).toEqual([expect.objectContaining({ attemptId: attempt.id, name: "plan", type: "plan", value: "1. Fix totals" })]);
    expect(commands).toEqual([
      { type: "run.resume", machineId: f.machine.id, runId },
      { type: "needs.changed" },
      notifyAnn("approved", runId, nodeId("Approve a plan")),
    ]);
    expect((await audit()).find((e) => e.action === "run.approve")).toMatchObject({ actorEmail: "bo@example.com", subjectId: runId });
  });

  it("T3-2: Reject needs feedback, fails the Run keeping the feedback, frees the Slot", async () => {
    const f = await fixture();
    const { runId, nodeId } = await planRun(f);
    const { request } = await waitAt(runId, nodeId("Approve a plan"), "approve");
    expect((await machineRunCounts(db, [f.machine.id])).get(f.machine.id)!.inUse).toBe(1);

    expect(await respondAs(deps, f.bo, request.id, { decision: "reject", feedback: " " })).toEqual({ ok: false, error: "Reject needs feedback for the next try." });
    expect(await respondAs(deps, f.bo, request.id, { decision: "reject", feedback: "Too broad." })).toEqual({ ok: true });
    expect(await getRun(db, runId)).toMatchObject({ state: "failed", failureReason: "Rejected at “Approve a plan”: Too broad." });
    const [stored] = await db.select().from(schema.humanRequest);
    expect(stored).toMatchObject({ response: { decision: "reject", feedback: "Too broad." }, respondedByEmail: "bo@example.com" });
    expect(commands).toEqual([{ type: "schedule", machineId: f.machine.id }, { type: "needs.changed" }, notifyAnn("rejected", runId, nodeId("Approve a plan"))]);
    expect((await machineRunCounts(db, [f.machine.id])).get(f.machine.id)!.inUse).toBe(0);
  });

  it("an Approve request refuses answers, and a Grill request refuses Approve", async () => {
    const f = await fixture(2);
    const plan = await planRun(f, 0);
    const approve = await waitAt(plan.runId, plan.nodeId("Approve a plan"), "approve");
    expect(await respondAs(deps, f.ann, approve.request.id, { decision: "answer", answers: {} })).toMatchObject({ ok: false });
    const grillRun = await planRun(f, 1);
    const grill = await waitAt(grillRun.runId, grillRun.nodeId("Grill a plan"), "grill");
    expect(await respondAs(deps, f.ann, grill.request.id, { decision: "approve" })).toMatchObject({ ok: false });
    expect(await respondAs(deps, f.ann, "not-a-uuid", { decision: "approve" })).toBe("not-found");
  });
});

describe("Grill answers (spec M3 §2.2)", () => {
  it("one form answers every question; an empty answer is refused; the Gateway resumes", async () => {
    const f = await fixture();
    const { runId, nodeId } = await planRun(f);
    const { attempt, request } = await waitAt(runId, nodeId("Grill a plan"), "grill");
    expect(await respondAs(deps, f.ann, request.id, { decision: "answer", answers: { q1: "/totals", q2: "" } })).toMatchObject({ ok: false });
    expect(await respondAs(deps, f.ann, request.id, { decision: "answer", answers: { q1: "/totals", q2: "Yes" } })).toEqual({ ok: true });
    expect((await getRun(db, runId))!.state).toBe("running");
    const [a] = await db.select().from(schema.attempt).where(sql`${schema.attempt.id} = ${attempt.id}`);
    expect(a).toMatchObject({ state: "running", claudeSessionId: "sess-1" });
    expect(commands).toEqual([{ type: "run.resume", machineId: f.machine.id, runId }, { type: "needs.changed" }]);
    expect((await audit()).map((e) => e.action)).toContain("run.answer");

    // The Run page shows the round, its answers and who answered.
    const view = await viewRun(deps, runId);
    if (view === "not-found") throw new Error("no run");
    // Who owns the Machine: the Run page tells its owner how to switch Claude accounts.
    expect(view).toMatchObject({ machineOwnerId: f.ann.id, machineConnected: true });
    const grill = view.timeline.find((n) => n.name === "Grill a plan")!;
    expect(grill.attempts[0]!.rounds).toEqual([
      expect.objectContaining({ round: 1, respondedBy: "ann@example.com", response: { decision: "answer", answers: { q1: "/totals", q2: "Yes" } } }),
    ]);
  });
});

describe("Grill questions with suggested options", () => {
  it("Needs you shows the options and the recommendation; the chosen option or Other's text is the answer", async () => {
    const f = await fixture();
    const { runId, nodeId } = await planRun(f);
    await db.update(schema.run).set({ state: "running" }).where(sql`${schema.run.id} = ${runId}`);
    const attempt = await createAttempt(db, { runId, flowNodeId: nodeId("Grill a plan"), number: 1, startedAt: clock.now() });
    const questions = [
      { id: "q1", text: "Rounding?", options: [{ label: "Per invoice", recommended: true }, { label: "Per line" }] },
      { id: "q2", text: "Formats?", multiSelect: true, options: [{ label: "CSV" }, { label: "XLSX" }] },
    ];
    await askHuman(db, { runId, attemptId: attempt.id, kind: "grill", questions, claudeSessionId: "sess-1", now: clock.now() });

    const [item] = await viewNeedsYou(deps);
    expect(item!.questions).toEqual(questions);
    expect(await respondAs(deps, f.ann, item!.id, { decision: "answer", answers: { q1: "Per invoice", q2: "CSV; ODS" } })).toEqual({ ok: true });
    const [request] = await db.select().from(schema.humanRequest);
    expect(request!.response).toEqual({ decision: "answer", answers: { q1: "Per invoice", q2: "CSV; ODS" } });
  });
});

describe("Needs you (RUN-5, spec M3 §3)", () => {
  it("lists every open request oldest first with Ticket, Flow, Node, Starter and waiting time; the count follows", async () => {
    const f = await fixture(2);
    const first = await planRun(f, 0);
    await waitAt(first.runId, first.nodeId("Grill a plan"), "grill");
    await clock.advance(5 * 60_000);
    const second = await planRun(f, 1);
    const approve = await waitAt(second.runId, second.nodeId("Approve a plan"), "approve");
    await clock.advance(60_000);

    const items = await viewNeedsYou(deps);
    expect(items.map((i) => [i.key, i.flowName, i.nodeName, i.kind, i.starter.email, i.waitedMs])).toEqual([
      ["web#1", "Plan and deliver", "Grill a plan", "grill", "ann@example.com", 6 * 60_000],
      ["web#2", "Plan and deliver", "Approve a plan", "approve", "ann@example.com", 60_000],
    ]);
    expect(items[0]!.questions).toHaveLength(2);
    expect(items[1]!.subject).toEqual({ name: "plan", type: "plan", value: "1. Fix totals" });
    expect(await needsYouCount(deps)).toBe(2);
    expect(await needsYouCount(deps)).toBe(items.length);

    await respondAs(deps, f.bo, approve.request.id, { decision: "approve" });
    expect(await needsYouCount(deps)).toBe(1);
    expect(await needsYouCount(deps)).toBe((await viewNeedsYou(deps)).length);
  });

  it("T3-5: two Members respond at once: the first wins, the second is told who answered", async () => {
    const f = await fixture();
    const { runId, nodeId } = await planRun(f);
    const { request } = await waitAt(runId, nodeId("Approve a plan"), "approve");
    const results = await Promise.all([
      respondAs(deps, f.ann, request.id, { decision: "approve" }),
      respondAs(deps, f.bo, request.id, { decision: "reject", feedback: "No" }),
    ]);
    const winner = results.findIndex((r) => r !== "not-found" && r.ok);
    expect(winner).toBeGreaterThanOrEqual(0);
    expect(results[1 - winner]).toEqual({ ok: false, error: `Already answered by ${winner === 0 ? "Ann" : "Bo"}.` });
    // Exactly one response is recorded and the Run took exactly one path.
    expect((await audit()).filter((e) => e.action === "run.approve" || e.action === "run.reject")).toHaveLength(1);
    expect((await getRun(db, runId))!.state).toBe(winner === 0 ? "running" : "failed");
  });

  it("a request closed by Cancel tells a late responder", async () => {
    const f = await fixture();
    const { runId, nodeId } = await planRun(f);
    const { request } = await waitAt(runId, nodeId("Approve a plan"), "approve");
    await cancelRunAs(deps, f.bo, runId);
    expect(await respondAs(deps, f.ann, request.id, { decision: "approve" })).toEqual({ ok: false, error: "The Run was cancelled meanwhile." });
    expect(await viewNeedsYou(deps)).toEqual([]);
  });
});

describe("Needs you updates live (#197)", () => {
  const decisions = [
    ["approve", "Approve a plan", { decision: "approve" }],
    ["reject", "Approve a plan", { decision: "reject", feedback: "No" }],
    ["answer", "Grill a plan", { decision: "answer", answers: { q1: "a", q2: "b" } }],
  ] as const;

  it.each(decisions)("%s with the Run's Machine removed still tells open Needs you pages", async (_, node, action) => {
    const f = await fixture();
    const { runId, nodeId } = await planRun(f);
    const { request } = await waitAt(runId, nodeId(node), node === "Grill a plan" ? "grill" : "approve");
    await db.update(schema.run).set({ machineId: null }).where(sql`${schema.run.id} = ${runId}`);
    expect(await respondAs(deps, f.bo, request.id, action)).toEqual({ ok: true });
    const kind = { approve: "approved", reject: "rejected", answer: "answered" }[action.decision];
    expect(commands).toEqual([{ type: "needs.changed" }, notifyAnn(kind, runId, nodeId(node))]);
  });

  it("a refused response tells nobody: the request is still open", async () => {
    const f = await fixture();
    const { runId, nodeId } = await planRun(f);
    const { request } = await waitAt(runId, nodeId("Approve a plan"), "approve");
    expect(await respondAs(deps, f.bo, request.id, { decision: "reject", feedback: " " })).toMatchObject({ ok: false });
    expect(commands).toEqual([]);
  });
});

describe("Starter notifications (#198)", () => {
  it("the Starter's own approve, reject, answer, retry and cancel publish no member.notify", async () => {
    const f = await fixture(3);
    const own = (c: GatewayCommand) => c.type === "member.notify";

    const approved = await planRun(f, 0);
    const approve = await waitAt(approved.runId, approved.nodeId("Approve a plan"), "approve");
    expect(await respondAs(deps, f.ann, approve.request.id, { decision: "approve" })).toEqual({ ok: true });

    const rejected = await planRun(f, 1);
    const reject = await waitAt(rejected.runId, rejected.nodeId("Approve a plan"), "approve");
    expect(await respondAs(deps, f.ann, reject.request.id, { decision: "reject", feedback: "No." })).toEqual({ ok: true });
    expect(await retryAs(deps, f.ann, rejected.runId, rejected.nodeId("Grill a plan"), "")).toEqual({ ok: true });

    const answered = await planRun(f, 2);
    const grill = await waitAt(answered.runId, answered.nodeId("Grill a plan"), "grill");
    expect(await respondAs(deps, f.ann, grill.request.id, { decision: "answer", answers: { q1: "a", q2: "b" } })).toEqual({ ok: true });
    expect(await cancelRunAs(deps, f.ann, answered.runId)).toEqual({ ok: true });

    expect(commands.length).toBeGreaterThan(0);
    expect(commands.filter(own)).toEqual([]);
  });

  it("a refused action notifies nobody", async () => {
    const f = await fixture();
    const { runId, nodeId } = await planRun(f);
    expect(await retryAs(deps, f.bo, runId, nodeId("Grill a plan"), "")).toMatchObject({ ok: false });
    expect(await cancelRunAs(deps, f.bo, "00000000-0000-0000-0000-000000000000")).toBe("not-found");
    expect(commands).toEqual([]);
  });
});

describe("Retry (RUN-7, RUN-9, spec M3 §4)", () => {
  async function failedRun(f: Awaited<ReturnType<typeof fixture>>) {
    const run = await planRun(f);
    const { request } = await waitAt(run.runId, run.nodeId("Approve a plan"), "approve");
    await respondAs(deps, f.bo, request.id, { decision: "reject", feedback: "Keep the old API." });
    commands = [];
    return run;
  }

  it("T3-7: a Failed Run keeps the Ticket's Active Run and the Flow's lock but frees its Slot", async () => {
    const f = await fixture();
    const { runId } = await failedRun(f);
    const run = (await getRun(db, runId))!;
    const flowId = run.flowId!;
    expect((await machineRunCounts(db, [f.machine.id])).get(f.machine.id)!.inUse).toBe(0);
    expect((await flowLocks(db, [flowId])).get(flowId)).toMatchObject({ runId, state: "failed" });
    const again = await startRuns(deps, f.ann, { flowId, ticketIds: [f.tickets[0]!.id], extraInstructions: "" });
    expect(again).toMatchObject({ ok: false, error: expect.stringContaining("already has an Active Run (failed)") });
  });

  it("any Member retries from a Node with a note: the Run is queued with a new queued_at, the retry context waits for the Node; audited", async () => {
    const f = await fixture();
    const { runId, nodeId } = await failedRun(f);
    await clock.advance(60_000);
    expect(await retryAs(deps, f.bo, runId, "00000000-0000-0000-0000-000000000000", "")).toEqual({ ok: false, error: "That Node is not part of this Run." });
    // Code a change comes after the rejected Approve a plan: a Retry cannot skip the approval.
    expect(await retryAs(deps, f.bo, runId, nodeId("Code a change"), "")).toEqual({
      ok: false,
      error: "Retry from the Node that failed or an earlier one: a Retry cannot skip a Node that did not succeed.",
    });
    expect(await retryAs(deps, f.bo, runId, nodeId("Grill a plan"), "Mind the rounding.")).toEqual({ ok: true });

    const run = (await getRun(db, runId))!;
    expect(run).toMatchObject({ state: "queued", queuedAt: clock.now(), endedAt: null, failureReason: null });
    expect(run.pendingRetry).toMatchObject({
      flowNodeId: nodeId("Grill a plan"),
      loginsChecked: false,
      context: { feedback: "Keep the old API.", note: "Mind the rounding.", retriedBy: "bo@example.com", failure: { node: "Approve a plan", exitCode: null } },
    });
    expect(commands).toEqual([{ type: "schedule", machineId: f.machine.id }, notifyAnn("retried", runId, nodeId("Grill a plan"))]);
    expect((await audit()).find((e) => e.action === "run.retry")).toMatchObject({
      actorEmail: "bo@example.com",
      detail: { node: "Grill a plan", note: "Mind the rounding.", from: "failed" },
    });
    // Only Failed or Interrupted Runs can be retried.
    expect(await retryAs(deps, f.bo, runId, nodeId("Code a change"), "")).toEqual({ ok: false, error: "Only a Failed or Interrupted Run can be retried." });
  });

  it("the Run page offers Retry from here with what the Node will receive, and keeps superseded Attempts, newest first", async () => {
    const f = await fixture();
    const { runId, nodeId } = await failedRun(f);
    let view = await viewRun(deps, runId);
    if (view === "not-found") throw new Error("no run");
    expect(view.retryable).toBe(true);
    expect(view.retryContext).toMatchObject({ feedback: "Keep the old API." });
    expect(view.timeline.find((n) => n.name === "Approve a plan")!.state).toBe("failed");

    await retryAs(deps, f.ann, runId, nodeId("Approve a plan"), "");
    view = await viewRun(deps, runId);
    if (view === "not-found") throw new Error("no run");
    const node = view.timeline.find((n) => n.name === "Approve a plan")!;
    expect(node.state).toBe("queued");
    expect(node.attempts).toEqual([expect.objectContaining({ number: 1, superseded: true, state: "failed" })]);
    expect(view.history.map((h) => h.action)).toEqual(["run.retry", "run.reject", "run.start"]);
  });
});

describe("Cancel from every Active state (T3-8, RUN-8)", () => {
  it.each(["queued", "running", "waiting_for_human", "failed", "interrupted"] as const)("%s ends cancelled", async (from) => {
    const f = await fixture();
    const { runId, nodeId } = await planRun(f);
    let attemptId: string | null = null;
    if (from === "waiting_for_human") {
      attemptId = (await waitAt(runId, nodeId("Approve a plan"), "approve")).attempt.id;
    } else if (from !== "queued") {
      await db.update(schema.run).set({ state: from }).where(sql`${schema.run.id} = ${runId}`);
      if (from === "running") attemptId = (await createAttempt(db, { runId, flowNodeId: nodeId("Grill a plan"), number: 1, startedAt: clock.now() })).id;
    }
    expect(await cancelRunAs(deps, f.bo, runId)).toEqual({ ok: true });
    expect((await getRun(db, runId))!.state).toBe("cancelled");
    // Only a Run that was waiting leaves the Needs you list.
    expect(commands).toEqual([
      { type: "run.cancel", machineId: f.machine.id, runId, attemptIds: attemptId ? [attemptId] : [] },
      ...(from === "waiting_for_human" ? [{ type: "needs.changed" }] : []),
      notifyAnn("cancelled", runId),
    ]);
    if (from === "waiting_for_human") {
      const [request] = await db.select().from(schema.humanRequest);
      expect(request).toMatchObject({ response: { cancelled: true }, respondedByEmail: "bo@example.com" });
    }
  });
});

describe("Audit (T3-12, RUN-15, spec M3 §7)", () => {
  // One test per RUN-15 action, each done through the app; terminal open and
  // close are audited by the Gateway (apps/gateway/test/terminals.test.ts, T1-4).
  async function lastEntry(action: string) {
    const entries = (await audit()).filter((e) => e.action === action);
    expect(entries.length).toBeGreaterThan(0);
    return entries.at(-1)!;
  }

  it("run.start", async () => {
    const f = await fixture();
    await planRun(f);
    expect(await lastEntry("run.start")).toMatchObject({ actorEmail: "ann@example.com", subjectType: "run" });
  });

  it("run.approve, run.reject, run.answer", async () => {
    const f = await fixture(3);
    const a = await planRun(f, 0);
    await respondAs(deps, f.bo, (await waitAt(a.runId, a.nodeId("Approve a plan"), "approve")).request.id, { decision: "approve" });
    const b = await planRun(f, 1);
    await respondAs(deps, f.bo, (await waitAt(b.runId, b.nodeId("Approve a plan"), "approve")).request.id, { decision: "reject", feedback: "No" });
    const c = await planRun(f, 2);
    await respondAs(deps, f.bo, (await waitAt(c.runId, c.nodeId("Grill a plan"), "grill")).request.id, { decision: "answer", answers: { q1: "a", q2: "b" } });
    expect(await lastEntry("run.approve")).toMatchObject({ actorEmail: "bo@example.com", subjectId: a.runId });
    expect(await lastEntry("run.reject")).toMatchObject({ actorEmail: "bo@example.com", subjectId: b.runId, detail: { feedback: "No" } });
    expect(await lastEntry("run.answer")).toMatchObject({ actorEmail: "bo@example.com", subjectId: c.runId, detail: { round: 1 } });
  });

  it("run.cancel and run.retry", async () => {
    const f = await fixture(2);
    const a = await planRun(f, 0);
    await cancelRunAs(deps, f.bo, a.runId);
    const b = await planRun(f, 1);
    await db.update(schema.run).set({ state: "interrupted" }).where(sql`${schema.run.id} = ${b.runId}`);
    await retryAs(deps, f.bo, b.runId, b.nodeId("Ticket"), "");
    expect(await lastEntry("run.cancel")).toMatchObject({ actorEmail: "bo@example.com", subjectId: a.runId });
    expect(await lastEntry("run.retry")).toMatchObject({ actorEmail: "bo@example.com", subjectId: b.runId, detail: { from: "interrupted" } });
  });

  it("machine.pair, machine.settings, machine.unpair, machine.remove", async () => {
    const cy = await memberRow(db, "cy@example.com");
    const pending = await createPairing(db, { tokenHash: hashToken("cy-token"), hostname: "cy-mac", os: "darwin", arch: "arm64" }, deps.clock.now());
    if (!pending.ok) throw new Error("pairing failed");
    const paired = await approveMyPairing(deps, cy, pending.pairing.code);
    if (!paired.ok) throw new Error("approve failed");
    await setMyMachineSettings(deps, cy, paired.machineId, { slots: 3 });
    await unpairMyMachine(deps, cy, paired.machineId);
    await removeMachine(deps, cy, paired.machineId);
    for (const action of ["machine.pair", "machine.settings", "machine.unpair", "machine.remove"]) {
      expect(await lastEntry(action)).toMatchObject({ actorEmail: "cy@example.com", subjectType: "machine", subjectId: paired.machineId });
    }
  });

  it("flow.create, flow.update, flow.delete", async () => {
    const f = await fixture();
    const run = await planRun(f);
    const sampleId = (await getRun(db, run.runId))!.flowId!;
    const copy = await cloneMyFlow(deps, f.bo, sampleId);
    if (!copy.ok) throw new Error("clone failed");
    const data = (await editorData(deps, copy.flowId))!;
    await saveMyFlow(deps, f.bo, copy.flowId, { name: "Renamed", nodes: data.graph.nodes, edges: data.graph.edges });
    await deleteMyFlow(deps, f.bo, copy.flowId);
    for (const action of ["flow.create", "flow.update", "flow.delete"]) {
      expect(await lastEntry(action)).toMatchObject({ actorEmail: "bo@example.com", subjectType: "flow", subjectId: copy.flowId });
    }
  });

  it("node.create, node.update, node.delete", async () => {
    const bo = await memberRow(db, "bo@example.com");
    const node = {
      name: "Lint",
      kind: "command",
      instructions: "",
      command: "npm run lint",
      inputs: [{ name: "branch", type: "branch", required: true }],
      outputs: [{ name: "report", type: "summary", optional: false }],
    };
    await createMyNode(deps, bo, node);
    const [row] = await db.select().from(schema.node);
    await updateMyNode(deps, bo, row!.id, { ...node, name: "Lint 2" });
    await deleteMyNode(deps, bo, row!.id);
    for (const action of ["node.create", "node.update", "node.delete"]) {
      expect(await lastEntry(action)).toMatchObject({ actorEmail: "bo@example.com", subjectType: "node", subjectId: row!.id });
    }
  });

  it("allowlist.add and allowlist.remove", async () => {
    const op = await memberRow(db, "op@example.com");
    await addToAllowlist(deps, op, "dee@example.com");
    await removeMember(deps, op, "dee@example.com");
    expect(await lastEntry("allowlist.add")).toMatchObject({ actorEmail: "op@example.com", subjectId: "dee@example.com" });
    expect(await lastEntry("allowlist.remove")).toMatchObject({ actorEmail: "op@example.com", subjectId: "dee@example.com" });
  });

  it("the audit page lists newest first and filters by Member and action; a Run shows its own history", async () => {
    const f = await fixture(2);
    const a = await planRun(f, 0);
    await clock.advance(1000);
    await cancelRunAs(deps, f.bo, a.runId);
    await planRun(f, 1);

    const all = await viewAudit(deps, {});
    expect(all.rows.map((r) => r.action)).toEqual(["run.start", "run.cancel", "run.start"]);
    expect(all.actors).toEqual(["ann@example.com", "bo@example.com"]);
    expect(all.actions).toEqual(["run.cancel", "run.start"]);
    expect((await viewAudit(deps, { member: "bo@example.com" })).rows.map((r) => r.action)).toEqual(["run.cancel"]);
    expect((await viewAudit(deps, { action: "run.start" })).rows).toHaveLength(2);

    const view = await viewRun(deps, a.runId);
    if (view === "not-found") throw new Error("no run");
    expect(view.history.map((h) => [h.action, h.actorEmail])).toEqual([
      ["run.cancel", "bo@example.com"],
      ["run.start", "ann@example.com"],
    ]);
  });
});
