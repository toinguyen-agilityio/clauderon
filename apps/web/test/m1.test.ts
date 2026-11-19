import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPairing, hashToken, schema, sql, type Db, type GatewayCommand } from "@clauderon/db";
import {
  FakeClock,
  FakeGitHub,
  createTestDatabase,
  machineRow,
  memberRow,
  projectRow,
  sampleFlowId,
  startSampleBatch,
  ticketRow,
  type TestDatabase,
} from "@clauderon/testing";
import type { AppDeps } from "../src/server/deps";
import {
  approveMyPairing,
  checkMyLogins,
  lookUpPairing,
  removeMachine,
  setMyMachineSettings,
  unpairMyMachine,
  viewMachine,
  viewMachines,
} from "../src/server/machines";
import { enableRepository, enableableRepositories, syncProject } from "../src/server/projects";
import { cancelRunAs, parsePullRequestTab, viewPullRequests, viewRun, viewRuns } from "../src/server/runs";
import { startDialog, startRuns } from "../src/server/start";
import { viewTickets } from "../src/server/tickets";

let test: TestDatabase;
let db: Db;
let deps: AppDeps;
let commands: GatewayCommand[];
let github: FakeGitHub;

beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
});
afterAll(() => test.drop());
beforeEach(async () => {
  await db.execute(sql`truncate member, machine, pairing, project, ticket, batch, run, attempt, output, audit_entry, flow, node cascade`);
  commands = [];
  github = new FakeGitHub();
  deps = {
    db,
    operators: [],
    clock: new FakeClock(),
    publish: () => {},
    command: async (c) => void commands.push(c),
    github,
  };
});

const actions = async () => (await db.select().from(schema.auditEntry)).map((a) => a.action);

describe("Machines (ADR 0006)", () => {
  /** A pending pairing an Agent asked for; its code is what the Member types. */
  async function pendingCode(token = "agent-token", hostname = "ann-laptop") {
    const result = await createPairing(db, { tokenHash: hashToken(token), hostname, os: "darwin", arch: "arm64" }, deps.clock.now());
    if (!result.ok) throw new Error(result.reason);
    return result.pairing.code;
  }

  it("Look up shows which computer a code belongs to; Approve pairs it as my Machine with 2 Slots", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const code = await pendingCode();
    expect(await lookUpPairing(deps, ann, `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase())).toEqual({
      ok: true,
      pairing: { code: `${code.slice(0, 4)}-${code.slice(4)}`, hostname: "ann-laptop", os: "darwin", arch: "arm64", expiresAt: expect.any(Date), replaces: null },
    });
    const approved = await approveMyPairing(deps, ann, code);
    expect(approved).toEqual({ ok: true, machineId: expect.any(String) });
    expect((await db.select().from(schema.machine))[0]).toMatchObject({ memberId: ann.id, hostname: "ann-laptop", slots: 2, tokenHash: hashToken("agent-token") });
    // A first pairing has no old Agent to disconnect.
    expect(commands).toEqual([]);
    expect(await actions()).toEqual(["machine.pair"]);
  });

  it("an unknown or expired code is refused with what to do", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const code = await pendingCode();
    expect(await lookUpPairing(deps, ann, "ZZZZ-ZZZZ")).toMatchObject({ ok: false, error: expect.stringContaining("No pairing waits for that code") });
    deps.clock = new FakeClock(new Date("2026-11-16T10:00:00Z"));
    expect(await approveMyPairing(deps, ann, code)).toMatchObject({ ok: false });
    expect(await db.select().from(schema.machine)).toEqual([]);
  });

  it("pairing a second computer replaces the first: the Gateway disconnects it, Slots and history stay", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const machine = await machineRow(db, ann.id, { slots: 3, hostname: "old-mac" });
    const code = await pendingCode("new-token", "new-mac");
    expect(await lookUpPairing(deps, ann, code)).toMatchObject({ ok: true, pairing: { replaces: "old-mac" } });
    expect(await approveMyPairing(deps, ann, code)).toEqual({ ok: true, machineId: machine.id });
    expect((await db.select().from(schema.machine))[0]).toMatchObject({ id: machine.id, hostname: "new-mac", slots: 3, connected: false });
    expect(commands).toEqual([{ type: "machine.repaired", machineId: machine.id }]);
  });

  it("the Machines page shows owner, Machine Ready, Slots in use and queue", async () => {
    const ann = await memberRow(db, "ann@example.com", "Ann");
    const machine = await machineRow(db, ann.id, { ghTokenScope: { tokenRepos: ["acme/web"] }, ghAccount: "ann-gh", claudeAccount: "ann@example.com", claudePlan: "pro" });
    const project = await projectRow(db);
    const t1 = await ticketRow(db, project.id, 1);
    const t2 = await ticketRow(db, project.id, 2);
    await startSampleBatch(db, ann, machine.id, [t1.id, t2.id], deps.clock.now());
    await db.update(schema.run).set({ state: "running" }).where(sql`ticket_id = ${t1.id}`);

    const view = await viewMachines(deps, ann);
    expect(view.mine).toMatchObject({ id: machine.id, paired: true, ready: true, inUse: 1, queued: 1, ghAccount: "ann-gh", claudeAccount: "ann@example.com", claudePlan: "pro", tokenRepos: ["acme/web"], owner: { name: "Ann" } });

    await db.update(schema.machine).set({ connected: false });
    expect((await viewMachines(deps, ann)).mine).toMatchObject({ ready: false });
  });

  it("the Machine page shows the Runs holding Slots and the queue to every Member, actions only to the owner", async () => {
    const ann = await memberRow(db, "ann@example.com", "Ann");
    const bob = await memberRow(db, "bob@example.com");
    const machine = await machineRow(db, ann.id, { slots: 1 });
    const project = await projectRow(db);
    const t1 = await ticketRow(db, project.id, 1);
    const t2 = await ticketRow(db, project.id, 2);
    await startSampleBatch(db, ann, machine.id, [t1.id, t2.id], deps.clock.now());
    await db.update(schema.run).set({ state: "waiting_for_human" }).where(sql`ticket_id = ${t1.id}`);

    const mine = await viewMachine(deps, ann, machine.id);
    expect(mine).toMatchObject({ machine: { id: machine.id, mine: true, inUse: 1, queued: 1 }, canRemove: true });
    if (mine === "not-found") throw new Error("expected the Machine");
    expect(mine.using).toEqual([expect.objectContaining({ state: "waiting_for_human", key: expect.stringMatching(/#1$/) })]);
    expect(mine.machine.queue).toEqual([expect.objectContaining({ state: "queued", position: 1, key: expect.stringMatching(/#2$/) })]);

    expect(await viewMachine(deps, bob, machine.id)).toMatchObject({ machine: { id: machine.id, mine: false }, canRemove: false });
    expect(await viewMachine(deps, ann, "not-a-uuid")).toBe("not-found");
  });

  it("Check logins asks the Gateway, the owner's only", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const bob = await memberRow(db, "bob@example.com");
    const machine = await machineRow(db, ann.id);
    expect(await checkMyLogins(deps, bob, machine.id)).toBe("not-found");
    expect(await checkMyLogins(deps, ann, machine.id)).toEqual({ ok: true });
    expect(commands).toEqual([{ type: "machine.checkLogins", machineId: machine.id }]);
  });

  it("Unpair stops the token and tells the Gateway; the Machine and its Slots stay", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const bob = await memberRow(db, "bob@example.com");
    const machine = await machineRow(db, ann.id, { slots: 4 });
    expect(await unpairMyMachine(deps, bob, machine.id)).toBe("not-found");
    expect(await unpairMyMachine(deps, ann, machine.id)).toEqual({ ok: true });
    expect((await db.select().from(schema.machine))[0]).toMatchObject({ tokenHash: null, connected: false, slots: 4 });
    expect(commands).toEqual([{ type: "machine.repaired", machineId: machine.id }]);
    expect((await viewMachines(deps, ann)).mine).toMatchObject({ paired: false, ready: false });
  });

  it("Remove is refused while a Run is Active, then deletes the row and keeps the ended Runs", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const bob = await memberRow(db, "bob@example.com");
    const machine = await machineRow(db, ann.id);
    const project = await projectRow(db);
    const ticket = await ticketRow(db, project.id, 1);
    await startSampleBatch(db, ann, machine.id, [ticket.id], deps.clock.now());

    expect(await removeMachine(deps, bob, machine.id)).toBe("not-found");
    for (const state of ["queued", "failed", "interrupted"] as const) {
      await db.update(schema.run).set({ state });
      expect(await removeMachine(deps, ann, machine.id)).toEqual({ ok: false, reason: "busy" });
    }
    expect(commands).toEqual([]);

    await db.update(schema.run).set({ state: "succeeded" });
    expect(await removeMachine(deps, ann, machine.id)).toEqual({ ok: true });
    expect(await db.select().from(schema.machine)).toEqual([]);
    expect((await db.select().from(schema.run))[0]).toMatchObject({ machineId: null, state: "succeeded" });
    expect(commands).toEqual([{ type: "machine.repaired", machineId: machine.id }]);
    expect(await actions()).toContain("machine.remove");
    expect(await viewRun(deps, (await db.select().from(schema.run))[0]!.id)).toMatchObject({ machineOwner: null });
  });

  it("an Operator can remove another Member's Machine", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const op = await memberRow(db, "op@example.com");
    const machine = await machineRow(db, ann.id);
    deps.operators = ["op@example.com"];
    expect(await viewMachine(deps, op, machine.id)).toMatchObject({ canRemove: true, machine: { mine: false } });
    expect(await removeMachine(deps, op, machine.id)).toEqual({ ok: true });
    expect(await actions()).toEqual(["machine.remove"]);
  });
});

describe("Projects and Sync (PRJ-1, PRJ-2, TIC-5)", () => {
  it("lists readable repositories minus enabled ones, then only the first owner's", async () => {
    github.addRepository({ owner: "acme", repo: "web", defaultBranch: "main", branches: ["main", "dev"] });
    github.addRepository({ owner: "acme", repo: "api", defaultBranch: "trunk" });
    github.addRepository({ owner: "other", repo: "web", defaultBranch: "main" });
    const ann = await memberRow(db, "ann@example.com");

    expect((await enableableRepositories(deps)).map((r) => `${r.owner}/${r.repo}`)).toEqual(["acme/api", "acme/web", "other/web"]);
    expect(await enableRepository(deps, ann, { owner: "acme", repo: "web", baseBranch: "nope" })).toEqual({ ok: false, reason: "no-branch" });
    expect(await enableRepository(deps, ann, { owner: "acme", repo: "web", baseBranch: "dev" })).toMatchObject({ ok: true });
    expect((await enableableRepositories(deps)).map((r) => `${r.owner}/${r.repo}`)).toEqual(["acme/api"]);
    expect(await enableRepository(deps, ann, { owner: "other", repo: "web", baseBranch: "main" })).toEqual({ ok: false, reason: "other-owner" });
    expect(await actions()).toEqual(["project.enable"]);
  });

  it("T1-7: Sync adds open issues, marks a vanished one Closed, records author association, and starts no Run", async () => {
    github.addRepository({ owner: "acme", repo: "web", defaultBranch: "main" });
    github.addIssue("acme", "web", { number: 1, title: "One", authorAssociation: "OWNER", labels: ["bug"] });
    github.addIssue("acme", "web", { number: 2, title: "Two", authorAssociation: "NONE" });
    const ann = await memberRow(db, "ann@example.com");
    const project = await projectRow(db);

    expect(await syncProject(deps, ann, project.id)).toEqual({ ok: true, summary: { added: 2, updated: 0, closed: 0 } });

    // Issue 2 is closed on GitHub, issue 3 is new.
    (await github.getIssue("acme", "web", 2))!.state = "closed";
    github.addIssue("acme", "web", { number: 3, title: "Three" });
    expect(await syncProject(deps, ann, project.id)).toEqual({ ok: true, summary: { added: 1, updated: 1, closed: 1 } });

    const tickets = await db.select().from(schema.ticket).orderBy(schema.ticket.number);
    expect(tickets.map((t) => [t.number, t.issueState, t.authorAssociation])).toEqual([
      [1, "open", "OWNER"],
      [2, "closed", "NONE"],
      [3, "open", "MEMBER"],
    ]);
    expect(await db.select().from(schema.run)).toEqual([]);
    expect(commands).toEqual([]);
    expect(await actions()).toEqual(["project.sync", "project.sync"]);
    expect((await viewTickets(deps, {})).rows.find((r) => r.number === 2)?.status).toBe("Closed");
  });

  it("Sync refreshes the state of recorded pull requests and shows GitHub errors on the Project", async () => {
    github.addRepository({ owner: "acme", repo: "web", defaultBranch: "main" });
    github.addIssue("acme", "web", { number: 5, title: "Five" });
    const ann = await memberRow(db, "ann@example.com");
    const machine = await machineRow(db, ann.id);
    const project = await projectRow(db);
    const ticket = await ticketRow(db, project.id, 5);
    await startSampleBatch(db, ann, machine.id, [ticket.id], deps.clock.now());
    await db.update(schema.run).set({ state: "succeeded", branch: "clauderon/5-x-abc", pullRequestNumber: 9, pullRequestState: "open" });
    github.addPullRequest("acme", "web", { number: 9, branch: "clauderon/5-x-abc", state: "merged", url: "u" });

    await syncProject(deps, ann, project.id);
    expect((await viewTickets(deps, {})).rows[0]!.status).toBe("PR merged");

    const broken = await projectRow(db, "acme", "gone");
    const result = await syncProject(deps, ann, broken.id);
    expect(result).toEqual({ ok: false, error: expect.stringContaining("acme/gone") });
    const [stored] = await db.select().from(schema.project).where(sql`repo = 'gone'`);
    expect(stored!.syncError).toContain("acme/gone");
  });
});

describe("Pull requests page", () => {
  it("lists Runs that opened a pull request by state, refreshing open ones from GitHub", async () => {
    github.addRepository({ owner: "acme", repo: "web", defaultBranch: "main" });
    const ann = await memberRow(db, "ann@example.com");
    const machine = await machineRow(db, ann.id);
    const project = await projectRow(db);
    const tickets = [await ticketRow(db, project.id, 5), await ticketRow(db, project.id, 6), await ticketRow(db, project.id, 7)];
    await startSampleBatch(db, ann, machine.id, tickets.map((t) => t.id), deps.clock.now());
    const runs = await db.select().from(schema.run);
    const byTicket = new Map(runs.map((r) => [r.ticketId, r.id]));
    await db.update(schema.run).set({ state: "succeeded", branch: "clauderon/5-a", pullRequestNumber: 15, pullRequestState: "open" }).where(sql`id = ${byTicket.get(tickets[0]!.id)}`);
    await db.update(schema.run).set({ state: "succeeded", branch: "clauderon/6-b", pullRequestNumber: 16, pullRequestState: "closed" }).where(sql`id = ${byTicket.get(tickets[1]!.id)}`);
    // Ticket 7's Run opened no pull request, so it is not listed.
    github.addPullRequest("acme", "web", { number: 15, branch: "clauderon/5-a", state: "merged", url: "u15" });

    const all = await viewPullRequests(deps, undefined, 1);
    expect(all.rows.map((r) => [r.pullRequestNumber, r.pullRequestState]).sort()).toEqual([
      [15, "merged"],
      [16, "closed"],
    ]);
    expect(all.counts).toEqual({ merged: 1, closed: 1 });
    expect((await viewPullRequests(deps, "closed", 1)).rows.map((r) => r.pullRequestNumber)).toEqual([16]);
    expect((await viewPullRequests(deps, "open", 1)).rows).toEqual([]);
  });

  it("keeps only known states from the URL", () => {
    expect(parsePullRequestTab("merged")).toBe("merged");
    expect(parsePullRequestTab("draft")).toBeUndefined();
    expect(parsePullRequestTab(undefined)).toBeUndefined();
  });
});

describe("Tickets page (TIC-1, TIC-2, TIC-3, TIC-7)", () => {
  it("T1-8: two Projects with the same repository name show owner/repo#n keys; search and filters work", async () => {
    const web = await projectRow(db, "acme", "web");
    const fork = await projectRow(db, "other", "web");
    const api = await projectRow(db, "acme", "api");
    await ticketRow(db, web.id, 4, { title: "Fix ledger totals" });
    await ticketRow(db, fork.id, 4, { title: "Fork thing" });
    await ticketRow(db, api.id, 9, { title: "Add endpoint", issueState: "closed" });

    const all = await viewTickets(deps, {});
    expect(all.rows.map((r) => r.key).sort()).toEqual(["acme/web#4", "api#9", "other/web#4"]);
    expect((await viewTickets(deps, { q: "ledger" })).rows.map((r) => r.key)).toEqual(["acme/web#4"]);
    expect((await viewTickets(deps, { q: "api#9" })).rows.map((r) => r.key)).toEqual(["api#9"]);
    expect((await viewTickets(deps, { projectId: fork.id })).rows.map((r) => r.key)).toEqual(["other/web#4"]);
    expect((await viewTickets(deps, { status: "Closed" })).rows.map((r) => r.key)).toEqual(["api#9"]);
  });

  it("a Ticket with an Active Run cannot be selected and names the Run", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const machine = await machineRow(db, ann.id);
    const project = await projectRow(db);
    const ticket = await ticketRow(db, project.id, 1);
    const start = await startSampleBatch(db, ann, machine.id, [ticket.id], deps.clock.now());
    const [row] = (await viewTickets(deps, {})).rows;
    expect(row).toMatchObject({ status: "Queued", activeRunId: start.ok ? start.runIds[0] : null });
  });
});

describe("Start dialog (RUN-1, POD-5, TIC-7, TIC-9)", () => {
  async function ready(values = {}) {
    const ann = await memberRow(db, "ann@example.com");
    const machine = await machineRow(db, ann.id, values);
    const project = await projectRow(db);
    const mine = await ticketRow(db, project.id, 1, { authorAssociation: "MEMBER" });
    const outside = await ticketRow(db, project.id, 2, { authorAssociation: "NONE" });
    await sampleFlowId(db); // seeds the samples
    const flows = (await startDialog(deps, ann, [mine.id])).flows;
    return { ann, machine, mine, outside, flowId: flows.find((f) => f.name === "Basic ticket delivery")!.id };
  }

  it("shows the Machine, its Slots and Machine Ready, and warns about outside authors without blocking", async () => {
    const { ann, mine, outside } = await ready();
    const dialog = await startDialog(deps, ann, [mine.id, outside.id]);
    expect(dialog.machine).toMatchObject({ slots: 2, inUse: 0, queued: 0, ready: true, connected: true, paired: true });
    expect(dialog.warnings).toEqual([{ ticketId: outside.id, key: "web#2", authorAssociation: "NONE" }]);
    expect(dialog.flows.map((f) => f.name).sort()).toEqual(["Basic ticket delivery", "Plan and deliver"]);
  });

  it("T1-5: Start in Real mode is refused when gh is not logged in, with a link to the Machine", async () => {
    const { ann, machine, mine, flowId } = await ready({ ghLoggedIn: false });
    expect(await startRuns(deps, ann, { flowId, ticketIds: [mine.id], extraInstructions: "" })).toEqual({
      ok: false,
      error: "gh is not logged in on your Machine. Log in on your Machine in your own terminal, then check logins on its page.",
      machinePage: `/machines/${machine.id}`,
    });
    expect(await db.select().from(schema.run)).toEqual([]);
  });

  it("a Dry-run Start needs no logins and queues a dry Run", async () => {
    const { ann, machine, mine, flowId } = await ready({ ghLoggedIn: false, claudeLoggedIn: false });
    const result = await startRuns(deps, ann, { flowId, ticketIds: [mine.id], extraInstructions: "", mode: "dry" });
    expect(result).toMatchObject({ ok: true });
    expect(await db.select().from(schema.run)).toEqual([expect.objectContaining({ mode: "dry", state: "queued", machineId: machine.id })]);
    expect(commands).toEqual([{ type: "schedule", machineId: machine.id }]);
  });

  it("refuses a Member with no paired Machine", async () => {
    const bob = await memberRow(db, "bob@example.com");
    const { ann, mine, flowId } = await ready();
    expect(await startRuns(deps, bob, { flowId, ticketIds: [mine.id], extraInstructions: "" })).toMatchObject({ ok: false, error: "You have no paired Machine yet." });
    await db.update(schema.machine).set({ tokenHash: null });
    expect(await startRuns(deps, ann, { flowId, ticketIds: [mine.id], extraInstructions: "" })).toMatchObject({ ok: false, machinePage: "/machines" });
  });

  it("creates a Batch with one queued Run per Ticket, audits each and asks the Gateway to schedule", async () => {
    const { ann, machine, mine, outside, flowId } = await ready();
    const result = await startRuns(deps, ann, { flowId, ticketIds: [mine.id, outside.id], extraInstructions: "Be brief." });
    expect(result).toEqual({ ok: true, batchId: expect.any(String), runIds: [expect.any(String), expect.any(String)] });
    const runs = await db.select().from(schema.run);
    expect(runs.every((r) => r.state === "queued" && r.machineId === machine.id && r.mode === "real")).toBe(true);
    expect(commands).toEqual([{ type: "schedule", machineId: machine.id }]);
    expect(await actions()).toEqual(["run.start", "run.start"]);
  });

  it("an offline Machine with both logins accepts the Batch", async () => {
    const { ann, mine, flowId } = await ready({ connected: false });
    expect((await startRuns(deps, ann, { flowId, ticketIds: [mine.id], extraInstructions: "" })).ok).toBe(true);
  });

  it("marks a Flow with Human Nodes and starts it (spec M3 §1)", async () => {
    const { ann, mine } = await ready();
    const { flows } = await startDialog(deps, ann, [mine.id]);
    expect(flows.map((f) => [f.name, f.needsHuman]).sort()).toEqual([
      ["Basic ticket delivery", false],
      ["Plan and deliver", true],
    ]);
    const plan = flows.find((f) => f.needsHuman)!;
    expect(await startRuns(deps, ann, { flowId: plan.id, ticketIds: [mine.id], extraInstructions: "" })).toMatchObject({ ok: true });
    expect(await db.select().from(schema.run)).toHaveLength(1);
  });

  it("T1-9: Start with a Ticket that already has an Active Real Run fails with a message naming it", async () => {
    const { ann, mine, outside, flowId } = await ready();
    await startRuns(deps, ann, { flowId, ticketIds: [mine.id], extraInstructions: "" });
    await db.update(schema.run).set({ state: "failed" });
    const again = await startRuns(deps, ann, { flowId, ticketIds: [outside.id, mine.id], extraInstructions: "" });
    expect(again).toEqual({ ok: false, error: expect.stringMatching(/^web#1 already has an Active Run \(failed\)/) });
    expect(await db.select().from(schema.run)).toHaveLength(1);
  });
});

describe("Runs (TRK-1, TRK-2, TRK-7)", () => {
  it("lists Runs newest first with combined filters, and shows a Run's timeline in topological order", async () => {
    const ann = await memberRow(db, "ann@example.com", "Ann");
    const machine = await machineRow(db, ann.id);
    const project = await projectRow(db);
    const t1 = await ticketRow(db, project.id, 1);
    const t2 = await ticketRow(db, project.id, 2);
    const first = await startSampleBatch(db, ann, machine.id, [t1.id], deps.clock.now());
    const second = await startSampleBatch(db, ann, machine.id, [t2.id], new Date(deps.clock.now().getTime() + 60_000));
    if (!first.ok || !second.ok) throw new Error("start failed");
    await db.update(schema.run).set({ state: "failed", failureReason: "boom" }).where(sql`id = ${first.runIds[0]}`);

    const list = await viewRuns(deps, {}, 1);
    expect(list.rows.map((r) => r.id)).toEqual([second.runIds[0], first.runIds[0]]);
    expect((await viewRuns(deps, { state: "failed", machineId: machine.id }, 1)).rows.map((r) => r.id)).toEqual([first.runIds[0]]);
    expect((await viewRuns(deps, { state: "failed", flowId: "00000000-0000-0000-0000-000000000000" }, 1)).rows).toEqual([]);

    const run = await viewRun(deps, first.runIds[0]!);
    expect(run).not.toBe("not-found");
    if (run === "not-found") return;
    expect(run.key).toBe("web#1");
    expect(run.timeline.map((n) => [n.name, n.state])).toEqual([
      ["Ticket", "not reached"],
      ["Code a change", "not reached"],
      ["Run tests", "not reached"],
      ["Open a pull request", "not reached"],
    ]);
    expect(await viewRun(deps, "nope")).toBe("not-found");
  });
});

describe("Slots, limits and the queue (spec M2 §6)", () => {
  it("T2-9: setting Slots above the cap is refused and saves nothing", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const machine = await machineRow(db, ann.id);
    expect(await setMyMachineSettings(deps, ann, machine.id, { slots: 9 })).toEqual({ ok: false, error: "Slots are capped at 8." });
    expect(await setMyMachineSettings(deps, ann, machine.id, { slots: 2, name: "x".repeat(61) })).toEqual({ ok: false, error: "The name is at most 60 characters." });
    expect((await db.select().from(schema.machine))[0]!.slots).toBe(2);
    expect(commands).toEqual([]);
  });

  it("the owner saves name and Slots, an audit entry records them and the Gateway is asked to schedule", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const machine = await machineRow(db, ann.id);
    expect(await setMyMachineSettings(deps, ann, machine.id, { slots: "3", name: "Build box" })).toEqual({ ok: true });
    expect((await db.select().from(schema.machine))[0]).toMatchObject({ name: "Build box", slots: 3 });
    expect(await setMyMachineSettings(deps, ann, machine.id, { slots: 3, name: "   " })).toEqual({ ok: true });
    expect((await db.select().from(schema.machine))[0]!.name).toBeNull();
    expect(commands).toEqual([
      { type: "schedule", machineId: machine.id },
      { type: "schedule", machineId: machine.id },
    ]);
    const [entry] = await db.select().from(schema.auditEntry);
    expect(entry).toMatchObject({ action: "machine.settings", actorEmail: "ann@example.com" });
  });

  it("another Member gets not-found and changes nothing", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const bob = await memberRow(db, "bob@example.com");
    const machine = await machineRow(db, ann.id);
    expect(await setMyMachineSettings(deps, bob, machine.id, { slots: 3 })).toBe("not-found");
    expect((await db.select().from(schema.machine))[0]!.slots).toBe(2);
  });

  it("the Machines page lists Queued Runs in start order, and the Start dialog shows where new Runs land", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const machine = await machineRow(db, ann.id, { slots: 1 });
    const project = await projectRow(db);
    const tickets = [await ticketRow(db, project.id, 1), await ticketRow(db, project.id, 2), await ticketRow(db, project.id, 3)];
    const start = await startSampleBatch(db, ann, machine.id, tickets.map((t) => t.id), new Date("2026-11-16T09:00:00Z"));
    expect(start.ok).toBe(true);
    await db.update(schema.run).set({ state: "running" }).where(sql`${schema.run.ticketId} = ${tickets[0]!.id}`);

    const view = await viewMachines(deps, ann);
    expect(view.machines[0]!.queue.map((q) => q.key)).toEqual(expect.arrayContaining([expect.stringMatching(/#[23]$/)]));
    expect(view.machines[0]!.queue.map((q) => q.position)).toEqual([1, 2]);

    const fresh = await ticketRow(db, project.id, 4);
    const dialog = await startDialog(deps, ann, [fresh.id]);
    expect(dialog.positions).toEqual([3]);
  });
});

describe("Cancel (RUN-8, MEM-2)", () => {
  it("any Member cancels an Active Run: it ends at once, the Gateway is told, and the Machine can then be removed", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const bob = await memberRow(db, "bob@example.com");
    const machine = await machineRow(db, ann.id);
    const project = await projectRow(db);
    const ticket = await ticketRow(db, project.id, 1);
    const start = await startSampleBatch(db, ann, machine.id, [ticket.id], deps.clock.now());
    if (!start.ok) throw new Error("start failed");
    const runId = start.runIds[0]!;
    await db.update(schema.run).set({ state: "running" });
    const [attempt] = await db
      .insert(schema.attempt)
      .values({ runId, flowNodeId: "00000000-0000-0000-0000-000000000001", number: 1, state: "running" })
      .returning();

    expect(await removeMachine(deps, ann, machine.id)).toEqual({ ok: false, reason: "busy" });
    expect(await cancelRunAs(deps, bob, runId)).toEqual({ ok: true });
    expect((await db.select().from(schema.run))[0]).toMatchObject({ state: "cancelled", endedAt: deps.clock.now() });
    expect((await db.select().from(schema.attempt))[0]).toMatchObject({ id: attempt!.id, state: "cancelled" });
    expect(commands).toEqual([{ type: "run.cancel", machineId: machine.id, runId, attemptIds: [attempt!.id] }]);
    expect(await actions()).toContain("run.cancel");

    expect(await cancelRunAs(deps, ann, runId)).toEqual({ ok: false, reason: "ended" });
    expect(await cancelRunAs(deps, ann, "not-a-uuid")).toBe("not-found");
    expect(await removeMachine(deps, ann, machine.id)).toEqual({ ok: true });
  });
});
