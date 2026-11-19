import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addAllowlistEntry, schema, sql, type Db, type GatewayCommand } from "@clauderon/db";
import { FakeClock, FakeGitHub, createTestDatabase, machineRow, memberRow, projectRow, startSampleBatch, ticketRow, type TestDatabase } from "@clauderon/testing";
import type { AppDeps } from "../src/server/deps";
import { removeMachine } from "../src/server/machines";
import { removeMember, viewMembers } from "../src/server/members";

let test: TestDatabase;
let db: Db;
let deps: AppDeps;
let commands: GatewayCommand[];
let revoked: string[];

beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
});
afterAll(() => test.drop());
beforeEach(async () => {
  await db.execute(sql`truncate member, allowlist_entry, machine, pairing, project, ticket, batch, run, attempt, output, audit_entry, flow, node cascade`);
  commands = [];
  revoked = [];
  deps = {
    db,
    operators: ["op@example.com"],
    clock: new FakeClock(),
    publish: (email) => void revoked.push(email),
    command: async (c) => void commands.push(c),
    github: new FakeGitHub(),
  };
});

const allow = (email: string) => addAllowlistEntry(db, "op@example.com", email, deps.operators);
const signedIn = async (email: string, name: string | null = null) => {
  const m = await memberRow(db, email, name);
  await db.update(schema.member).set({ lastSignInAt: deps.clock.now() }).where(sql`id = ${m.id}`);
  return m;
};
const auditActions = async () => (await db.select().from(schema.auditEntry)).map((a) => a.action).sort();
const startRun = async (starter: { id: string; email: string }, machineId: string) => {
  const project = await projectRow(db);
  await startSampleBatch(db, starter, machineId, [(await ticketRow(db, project.id, 1)).id], deps.clock.now());
};

describe("Members page (MEM-4)", () => {
  it("lists Operators, Active and Invited members with their Machine and Active Runs; removed members only while their Machine is left", async () => {
    const op = await signedIn("op@example.com", "Olive");
    await allow("ann@example.com");
    await allow("bob@example.com");
    const ann = await signedIn("ann@example.com", "Ann");
    const machine = await machineRow(db, ann.id);
    await startRun(ann, machine.id);
    await db.update(schema.run).set({ state: "failed" });
    // Dee was removed before removing an email also removed the Machine.
    const dee = await signedIn("dee@example.com");
    await machineRow(db, dee.id, { connected: false });
    await memberRow(db, "eve@example.com"); // removed, no Machine: hidden

    const view = await viewMembers(deps, ann);
    expect(view.canManage).toBe(false);
    expect(view.rows.map((r) => [r.email, r.status, r.operator])).toEqual([
      ["op@example.com", "active", true],
      ["ann@example.com", "active", false],
      ["bob@example.com", "invited", false],
      ["dee@example.com", "removed", false],
    ]);
    expect(view.rows[0]).toMatchObject({ name: "Olive", machine: null });
    expect(view.rows[1]!.machine).toMatchObject({ id: machine.id, paired: true, connected: true, ready: true, activeRuns: 1 });
    expect(view.rows[3]!.machine).toMatchObject({ connected: false, ready: false });
    expect((await viewMembers(deps, op)).canManage).toBe(true);
  });

  it("removing a member is refused while their Machine has Active Runs, then removes the Machine and the email", async () => {
    const op = await signedIn("op@example.com");
    await allow("ann@example.com");
    const ann = await signedIn("ann@example.com");
    const machine = await machineRow(db, ann.id);
    await startRun(ann, machine.id);

    expect(await removeMember(deps, op, "ann@example.com")).toEqual({ ok: false, reason: "active-runs", activeRuns: 1, machineId: machine.id });
    expect(commands).toEqual([]);
    expect(revoked).toEqual([]);

    await db.update(schema.run).set({ state: "cancelled" });
    expect(await removeMember(deps, op, "ANN@example.com")).toEqual({ ok: true });
    expect(await db.select().from(schema.machine)).toEqual([]);
    expect(commands).toEqual([{ type: "machine.repaired", machineId: machine.id }]);
    expect(revoked).toEqual(["ann@example.com"]);
    expect(await auditActions()).toEqual(["allowlist.add", "allowlist.remove", "machine.remove", "run.start"]);
    expect((await viewMembers(deps, op)).rows.map((r) => r.email)).toEqual(["op@example.com"]);
  });

  it("an Invited member is removed at once; Operators cannot be removed and non-Operators cannot remove", async () => {
    const op = await signedIn("op@example.com");
    await allow("bob@example.com");
    await allow("ann@example.com");
    const ann = await signedIn("ann@example.com");
    expect(await removeMember(deps, ann, "bob@example.com")).toBe("not-found");
    expect(await removeMember(deps, op, "op@example.com")).toEqual({ ok: false, reason: "operator" });
    expect(await removeMember(deps, op, "bob@example.com")).toEqual({ ok: true });
    expect(await removeMember(deps, op, "bob@example.com")).toEqual({ ok: false, reason: "not-found" });
  });

  it("removing an already-removed member removes the Machine they left", async () => {
    const op = await signedIn("op@example.com");
    const dee = await signedIn("dee@example.com");
    const machine = await machineRow(db, dee.id);
    expect(await removeMember(deps, op, "dee@example.com")).toEqual({ ok: true });
    expect(commands).toEqual([{ type: "machine.repaired", machineId: machine.id }]);
  });

  it("an Operator can remove another member's Machine; other members cannot", async () => {
    const op = await signedIn("op@example.com");
    const ann = await signedIn("ann@example.com");
    const bob = await signedIn("bob@example.com");
    const machine = await machineRow(db, ann.id);
    expect(await removeMachine(deps, bob, machine.id)).toBe("not-found");
    expect(await removeMachine(deps, op, machine.id)).toEqual({ ok: true });
  });
});
