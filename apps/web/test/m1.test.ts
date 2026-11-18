import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { recordHostConnected, schema, sql, type Db, type GatewayCommand } from "@clauderon/db";
import {
  FakeClock,
  FakeGitHub,
  createTestDatabase,
  memberRow,
  podRow,
  projectRow,
  sampleFlowId,
  startSampleBatch,
  ticketRow,
  type TestDatabase,
} from "@clauderon/testing";
import type { AppDeps } from "../src/server/deps";
import { createMyPod, gbToMb, podAction, removePod, setMyPodSettings, terminalAccess, viewPod, viewPods } from "../src/server/pods";
import { enableRepository, enableableRepositories, syncProject } from "../src/server/projects";
import { cancelRunAs, viewRun, viewRuns } from "../src/server/runs";
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
  await db.execute(sql`truncate member, pod, project, ticket, batch, run, attempt, output, audit_entry, pod_host, flow, node cascade`);
  commands = [];
  github = new FakeGitHub();
  deps = {
    db,
    operators: [],
    clock: new FakeClock(),
    publish: () => {},
    command: async (c) => void commands.push(c),
    github,
    podImage: "ghcr.io/acme/clauderon-pod:2026-11-16",
    limitCeiling: { slots: 4, cpus: 4, memoryMb: 8192 },
  };
});

const actions = async () => (await db.select().from(schema.auditEntry)).map((a) => a.action);

describe("Pods (POD-2, POD-4, POD-6)", () => {
  it("T1-1: Create my Pod sends pod.create with 2/2/4096; a second Create is refused", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const created = await createMyPod(deps, ann);
    expect(created).toEqual({ ok: true, podId: expect.any(String) });
    const [pod] = await db.select().from(schema.pod);
    expect(pod).toMatchObject({ status: "creating", slots: 2, cpus: 2, memoryMb: 4096, imageTag: "ghcr.io/acme/clauderon-pod:2026-11-16" });
    expect(commands).toEqual([{ type: "pod.create", podId: pod!.id }]);
    expect(await createMyPod(deps, ann)).toEqual({ ok: false, reason: "exists" });
    expect(await actions()).toEqual(["pod.create"]);
  });

  it("Create my Pod takes the limits from its dialog, capped by the ceiling", async () => {
    const ann = await memberRow(db, "ann@example.com");
    expect(await createMyPod(deps, ann, { slots: 9, cpus: 2, memoryMb: 4096 })).toEqual({ ok: false, reason: "limits", error: "Slots are capped at 4." });
    expect(await db.select().from(schema.pod)).toEqual([]);
    expect(commands).toEqual([]);

    expect(await createMyPod(deps, ann, { slots: 2, cpus: 2, memoryMb: 4096, name: "x".repeat(61) })).toMatchObject({ ok: false, error: "The name is at most 60 characters." });
    expect(await createMyPod(deps, ann, { slots: 2, cpus: 2, memoryMb: gbToMb("9") })).toMatchObject({ ok: false, error: "RAM is capped at 8 GB." });

    expect(await createMyPod(deps, ann, { slots: "3", cpus: "1.5", memoryMb: gbToMb("2.5"), name: "  Ann's builder  " })).toEqual({ ok: true, podId: expect.any(String) });
    expect((await db.select().from(schema.pod))[0]).toMatchObject({ name: "Ann's builder", slots: 3, cpus: 1.5, memoryMb: 2560 });
  });

  it("T1-1: over-commit shows a warning but creates", async () => {
    await recordHostConnected(db, { agentVersion: "1", processId: "p", arch: "arm64", cpus: 4, memoryMb: 8192, diskGb: 100, dockerRunning: true }, new Date());
    for (const email of ["a@x.com", "b@x.com", "c@x.com"]) expect((await createMyPod(deps, await memberRow(db, email))).ok).toBe(true);
    const view = await viewPods(deps, (await db.select().from(schema.member))[0]!);
    expect(view.pods).toHaveLength(3);
    expect(view.overCommitted).toBe(true);
  });

  it("T1-2: Stop is refused while the Pod has a Running Run; only the owner can start or stop", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const bob = await memberRow(db, "bob@example.com");
    const pod = await podRow(db, ann.id);
    const project = await projectRow(db);
    const ticket = await ticketRow(db, project.id, 1);
    const start = await startSampleBatch(db, ann, pod.id, [ticket.id], deps.clock.now());
    await db.update(schema.run).set({ state: "running" });

    expect(await podAction(deps, bob, pod.id, "stop")).toBe("not-found");
    expect(await podAction(deps, ann, pod.id, "stop")).toEqual({ ok: false, reason: "busy" });
    expect(commands).toEqual([]);

    await db.update(schema.run).set({ state: "succeeded" });
    expect(start.ok).toBe(true);
    expect(await podAction(deps, ann, pod.id, "stop")).toEqual({ ok: true });
    expect(await podAction(deps, ann, pod.id, "refresh")).toEqual({ ok: true });
    expect(commands).toEqual([
      { type: "pod.stop", podId: pod.id },
      { type: "pod.checkLogins", podId: pod.id },
    ]);
    expect(await actions()).toContain("pod.stop");
  });

  it("the Pods page shows owner, Pod Ready, Slots in use and queue", async () => {
    const ann = await memberRow(db, "ann@example.com", "Ann");
    const pod = await podRow(db, ann.id, { ghTokenScope: { tokenRepos: ["acme/web"] }, ghAccount: "ann-gh" });
    const project = await projectRow(db);
    const t1 = await ticketRow(db, project.id, 1);
    const t2 = await ticketRow(db, project.id, 2);
    await startSampleBatch(db, ann, pod.id, [t1.id, t2.id], deps.clock.now());
    await db.update(schema.run).set({ state: "running" }).where(sql`ticket_id = ${t1.id}`);

    const view = await viewPods(deps, ann);
    expect(view.mine).toMatchObject({ id: pod.id, ready: true, inUse: 1, queued: 1, ghAccount: "ann-gh", tokenRepos: ["acme/web"], owner: { name: "Ann" } });
  });

  it("the Pod page shows the Runs holding Slots and the queue to every Member, actions only to the owner", async () => {
    const ann = await memberRow(db, "ann@example.com", "Ann");
    const bob = await memberRow(db, "bob@example.com");
    const pod = await podRow(db, ann.id, { slots: 1 });
    const project = await projectRow(db);
    const t1 = await ticketRow(db, project.id, 1);
    const t2 = await ticketRow(db, project.id, 2);
    await startSampleBatch(db, ann, pod.id, [t1.id, t2.id], deps.clock.now());
    await db.update(schema.run).set({ state: "waiting_for_human" }).where(sql`ticket_id = ${t1.id}`);

    const mine = await viewPod(deps, ann, pod.id);
    expect(mine).toMatchObject({ pod: { id: pod.id, mine: true, inUse: 1, queued: 1 } });
    if (mine === "not-found") throw new Error("expected the Pod");
    expect(mine.using).toEqual([expect.objectContaining({ state: "waiting_for_human", key: expect.stringMatching(/#1$/) })]);
    expect(mine.pod.queue).toEqual([expect.objectContaining({ state: "queued", position: 1, key: expect.stringMatching(/#2$/) })]);

    expect(await viewPod(deps, bob, pod.id)).toMatchObject({ pod: { id: pod.id, mine: false } });
    expect(await viewPod(deps, ann, "not-a-uuid")).toBe("not-found");
  });

  it("POD-7: Remove Pod is refused while a Run is Active, then deletes the row and keeps the ended Runs", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const bob = await memberRow(db, "bob@example.com");
    const pod = await podRow(db, ann.id);
    const project = await projectRow(db);
    const ticket = await ticketRow(db, project.id, 1);
    await startSampleBatch(db, ann, pod.id, [ticket.id], deps.clock.now());

    expect(await removePod(deps, bob, pod.id)).toBe("not-found");
    for (const state of ["queued", "failed", "interrupted"] as const) {
      await db.update(schema.run).set({ state });
      expect(await removePod(deps, ann, pod.id)).toEqual({ ok: false, reason: "busy" });
    }
    expect(commands).toEqual([]);

    await db.update(schema.run).set({ state: "succeeded" });
    expect(await removePod(deps, ann, pod.id)).toEqual({ ok: true });
    expect(await db.select().from(schema.pod)).toEqual([]);
    expect((await db.select().from(schema.run))[0]).toMatchObject({ podId: null, state: "succeeded" });
    expect(commands).toEqual([{ type: "pod.delete", podId: pod.id }]);
    expect(await actions()).toContain("pod.delete");
    expect(await viewRun(deps, (await db.select().from(schema.run))[0]!.id)).toMatchObject({ podOwner: null });

    // The owner can create a new Pod afterwards.
    expect((await createMyPod(deps, ann)).ok).toBe(true);
  });

  it("POD-7: an Operator can remove another Member's Pod", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const op = await memberRow(db, "op@example.com");
    const pod = await podRow(db, ann.id);
    deps.operators = ["op@example.com"];
    expect(await viewPod(deps, op, pod.id)).toMatchObject({ canRemove: true, pod: { mine: false } });
    expect(await removePod(deps, op, pod.id)).toEqual({ ok: true });
    expect(await actions()).toEqual(["pod.delete"]);
  });

  it("T1-3: a Member who is not the owner gets 404 on the terminal page", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const bob = await memberRow(db, "bob@example.com");
    const pod = await podRow(db, ann.id);
    expect(await terminalAccess(deps, bob, pod.id)).toBe("not-found");
    expect(await terminalAccess(deps, ann, "not-a-uuid")).toBe("not-found");
    expect(await terminalAccess(deps, ann, pod.id)).toMatchObject({ pod: { id: pod.id } });
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
    const pod = await podRow(db, ann.id);
    const project = await projectRow(db);
    const ticket = await ticketRow(db, project.id, 5);
    await startSampleBatch(db, ann, pod.id, [ticket.id], deps.clock.now());
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
    const pod = await podRow(db, ann.id);
    const project = await projectRow(db);
    const ticket = await ticketRow(db, project.id, 1);
    const start = await startSampleBatch(db, ann, pod.id, [ticket.id], deps.clock.now());
    const [row] = (await viewTickets(deps, {})).rows;
    expect(row).toMatchObject({ status: "Queued", activeRunId: start.ok ? start.runIds[0] : null });
  });
});

describe("Start dialog (RUN-1, POD-5, TIC-7, TIC-9)", () => {
  async function ready(values = {}) {
    const ann = await memberRow(db, "ann@example.com");
    const pod = await podRow(db, ann.id, values);
    const project = await projectRow(db);
    const mine = await ticketRow(db, project.id, 1, { authorAssociation: "MEMBER" });
    const outside = await ticketRow(db, project.id, 2, { authorAssociation: "NONE" });
    await sampleFlowId(db); // seeds the samples
    const flows = (await startDialog(deps, ann, [mine.id])).flows;
    return { ann, pod, mine, outside, flowId: flows.find((f) => f.name === "Basic ticket delivery")!.id };
  }

  it("shows the Pod, its Slots and Pod Ready, and warns about outside authors without blocking", async () => {
    const { ann, mine, outside } = await ready();
    const dialog = await startDialog(deps, ann, [mine.id, outside.id]);
    expect(dialog.pod).toMatchObject({ slots: 2, inUse: 0, queued: 0, ready: true });
    expect(dialog.warnings).toEqual([{ ticketId: outside.id, key: "web#2", authorAssociation: "NONE" }]);
    expect(dialog.flows.map((f) => f.name).sort()).toEqual(["Basic ticket delivery", "Plan and deliver"]);
  });

  it("T1-5: Start in Real mode is refused when gh is not logged in, with a link to the terminal", async () => {
    const { ann, pod, mine, flowId } = await ready({ ghLoggedIn: false });
    expect(await startRuns(deps, ann, { flowId, ticketIds: [mine.id], extraInstructions: "" })).toEqual({
      ok: false,
      error: "gh is not logged in on your Pod. Log in from its terminal.",
      terminal: `/pods/${pod.id}/terminal`,
    });
    expect(await db.select().from(schema.run)).toEqual([]);
  });

  it("a Dry-run Start needs no logins and queues a dry Run", async () => {
    const { ann, pod, mine, flowId } = await ready({ ghLoggedIn: false, claudeLoggedIn: false });
    const result = await startRuns(deps, ann, { flowId, ticketIds: [mine.id], extraInstructions: "", mode: "dry" });
    expect(result).toMatchObject({ ok: true });
    expect(await db.select().from(schema.run)).toEqual([expect.objectContaining({ mode: "dry", state: "queued", podId: pod.id })]);
    expect(commands).toEqual([{ type: "schedule", podId: pod.id }]);
  });

  it("refuses a Member with no Pod", async () => {
    const bob = await memberRow(db, "bob@example.com");
    const { mine, flowId } = await ready();
    expect(await startRuns(deps, bob, { flowId, ticketIds: [mine.id], extraInstructions: "" })).toMatchObject({ ok: false, error: "You have no Pod yet." });
  });

  it("creates a Batch with one queued Run per Ticket, audits each and asks the Gateway to schedule", async () => {
    const { ann, pod, mine, outside, flowId } = await ready();
    const result = await startRuns(deps, ann, { flowId, ticketIds: [mine.id, outside.id], extraInstructions: "Be brief." });
    expect(result).toEqual({ ok: true, batchId: expect.any(String), runIds: [expect.any(String), expect.any(String)] });
    const runs = await db.select().from(schema.run);
    expect(runs.every((r) => r.state === "queued" && r.podId === pod.id && r.mode === "real")).toBe(true);
    expect(commands).toEqual([{ type: "schedule", podId: pod.id }]);
    expect(await actions()).toEqual(["run.start", "run.start"]);
  });

  it("a stopped Pod with both logins accepts the Batch", async () => {
    const { ann, mine, flowId } = await ready({ status: "stopped" });
    expect((await startRuns(deps, ann, { flowId, ticketIds: [mine.id], extraInstructions: "" })).ok).toBe(true);
  });

  it("marks a Flow with Human Nodes and refuses to start it until M3", async () => {
    const { ann, mine } = await ready();
    const { flows } = await startDialog(deps, ann, [mine.id]);
    expect(flows.map((f) => [f.name, f.needsHuman]).sort()).toEqual([
      ["Basic ticket delivery", false],
      ["Plan and deliver", true],
    ]);
    const plan = flows.find((f) => f.needsHuman)!;
    expect(await startRuns(deps, ann, { flowId: plan.id, ticketIds: [mine.id], extraInstructions: "" })).toEqual({
      ok: false,
      error: "Plan and deliver has Human Nodes, which arrive in M3.",
    });
    expect(await db.select().from(schema.run)).toEqual([]);
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
    const pod = await podRow(db, ann.id);
    const project = await projectRow(db);
    const t1 = await ticketRow(db, project.id, 1);
    const t2 = await ticketRow(db, project.id, 2);
    const first = await startSampleBatch(db, ann, pod.id, [t1.id], deps.clock.now());
    const second = await startSampleBatch(db, ann, pod.id, [t2.id], new Date(deps.clock.now().getTime() + 60_000));
    if (!first.ok || !second.ok) throw new Error("start failed");
    await db.update(schema.run).set({ state: "failed", failureReason: "boom" }).where(sql`id = ${first.runIds[0]}`);

    const list = await viewRuns(deps, {}, 1);
    expect(list.rows.map((r) => r.id)).toEqual([second.runIds[0], first.runIds[0]]);
    expect((await viewRuns(deps, { state: "failed", podId: pod.id }, 1)).rows.map((r) => r.id)).toEqual([first.runIds[0]]);
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
  it("T2-9: setting Slots above the ceiling is refused and saves nothing", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const pod = await podRow(db, ann.id);
    expect(await setMyPodSettings(deps, ann, pod.id, { slots: 5, cpus: 2, memoryMb: 4096 })).toEqual({ ok: false, error: "Slots are capped at 4." });
    expect((await db.select().from(schema.pod))[0]!.slots).toBe(2);
    expect(commands).toEqual([]);
  });

  it("the owner saves limits, an audit entry records them and the Gateway is asked to schedule", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const pod = await podRow(db, ann.id);
    expect(await setMyPodSettings(deps, ann, pod.id, { slots: 3, cpus: 1, memoryMb: 2048, name: "Build box" })).toEqual({ ok: true });
    expect((await db.select().from(schema.pod))[0]).toMatchObject({ name: "Build box", slots: 3, cpus: 1, memoryMb: 2048 });
    expect(await setMyPodSettings(deps, ann, pod.id, { slots: 3, cpus: 1, memoryMb: 2048, name: "   " })).toEqual({ ok: true });
    expect((await db.select().from(schema.pod))[0]!.name).toBeNull();
    expect(commands).toEqual([
      { type: "schedule", podId: pod.id },
      { type: "schedule", podId: pod.id },
    ]);
    const [entry] = await db.select().from(schema.auditEntry);
    expect(entry).toMatchObject({ action: "pod.limits", actorEmail: "ann@example.com" });
  });

  it("another Member gets not-found and changes nothing", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const bob = await memberRow(db, "bob@example.com");
    const pod = await podRow(db, ann.id);
    expect(await setMyPodSettings(deps, bob, pod.id, { slots: 3, cpus: 1, memoryMb: 2048 })).toBe("not-found");
    expect((await db.select().from(schema.pod))[0]!.slots).toBe(2);
  });

  it("the Pods page lists Queued Runs in start order, and the Start dialog shows where new Runs land", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const pod = await podRow(db, ann.id, { slots: 1 });
    const project = await projectRow(db);
    const tickets = [await ticketRow(db, project.id, 1), await ticketRow(db, project.id, 2), await ticketRow(db, project.id, 3)];
    const start = await startSampleBatch(db, ann, pod.id, tickets.map((t) => t.id), new Date("2026-11-16T09:00:00Z"));
    expect(start.ok).toBe(true);
    await db.update(schema.run).set({ state: "running" }).where(sql`${schema.run.ticketId} = ${tickets[0]!.id}`);

    const view = await viewPods(deps, ann);
    expect(view.pods[0]!.queue.map((q) => q.key)).toEqual(expect.arrayContaining([expect.stringMatching(/#[23]$/)]));
    expect(view.pods[0]!.queue.map((q) => q.position)).toEqual([1, 2]);

    const fresh = await ticketRow(db, project.id, 4);
    const dialog = await startDialog(deps, ann, [fresh.id]);
    expect(dialog.positions).toEqual([3]);
  });
});

describe("Cancel (RUN-8, MEM-2)", () => {
  it("any Member cancels an Active Run: it ends at once, the Gateway is told, and the Pod can then be removed", async () => {
    const ann = await memberRow(db, "ann@example.com");
    const bob = await memberRow(db, "bob@example.com");
    const pod = await podRow(db, ann.id);
    const project = await projectRow(db);
    const ticket = await ticketRow(db, project.id, 1);
    const start = await startSampleBatch(db, ann, pod.id, [ticket.id], deps.clock.now());
    if (!start.ok) throw new Error("start failed");
    const runId = start.runIds[0]!;
    await db.update(schema.run).set({ state: "running" });
    const [attempt] = await db
      .insert(schema.attempt)
      .values({ runId, flowNodeId: "00000000-0000-0000-0000-000000000001", number: 1, state: "running" })
      .returning();

    expect(await removePod(deps, ann, pod.id)).toEqual({ ok: false, reason: "busy" });
    expect(await cancelRunAs(deps, bob, runId)).toEqual({ ok: true });
    expect((await db.select().from(schema.run))[0]).toMatchObject({ state: "cancelled", endedAt: deps.clock.now() });
    expect((await db.select().from(schema.attempt))[0]).toMatchObject({ id: attempt!.id, state: "cancelled" });
    expect(commands).toEqual([{ type: "run.cancel", podId: pod.id, runId, attemptIds: [attempt!.id] }]);
    expect(await actions()).toContain("run.cancel");

    expect(await cancelRunAs(deps, ann, runId)).toEqual({ ok: false, reason: "ended" });
    expect(await cancelRunAs(deps, ann, "not-a-uuid")).toBe("not-found");
    expect(await removePod(deps, ann, pod.id)).toEqual({ ok: true });
  });
});
