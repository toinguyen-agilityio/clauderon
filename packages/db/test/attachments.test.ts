import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { attachmentForMachine, attachmentsOfRun, hashToken, markAttachmentsDelivered, openAttachment, schema, sealAttachment, sha256Hex, startBatch, type Db } from "../src/index";
import { createTestDatabase, type TestDatabase } from "../src/test-database";

const SECRET = "a-session-secret-of-some-length";
const now = new Date("2026-11-25T09:00:00Z");

let test: TestDatabase;
let db: Db;

beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
});
afterAll(() => test.drop());

describe("sealing", () => {
  it("opens with the same secret only, and keeps size and hash of the plain bytes", () => {
    const data = Buffer.from("%PDF-1.7 secret plan");
    const sealed = sealAttachment({ name: "plan.pdf", data }, SECRET);
    expect(sealed).toMatchObject({ name: "plan.pdf", size: data.length, sha256: sha256Hex(data) });
    expect(sealed.sealed.includes(data)).toBe(false);
    expect(openAttachment(sealed.sealed, SECRET)).toEqual(data);
    expect(openAttachment(sealed.sealed, "another-secret")).toBeNull();
    expect(openAttachment(Buffer.from("short"), SECRET)).toBeNull();
  });
});

describe("a Run's attachments", () => {
  it("are stored with the Run, served only to its Machine until delivered, then keep only name and hash", async () => {
    const [ann] = await db.insert(schema.member).values({ email: "ann@example.com" }).returning();
    const [bob] = await db.insert(schema.member).values({ email: "bob@example.com" }).returning();
    const [mine] = await db.insert(schema.machine).values({ memberId: ann!.id, tokenHash: hashToken("a") }).returning();
    const [other] = await db.insert(schema.machine).values({ memberId: bob!.id, tokenHash: hashToken("b") }).returning();
    const [project] = await db.insert(schema.project).values({ owner: "acme", repo: "web", baseBranch: "main", enabledByEmail: "x@test" }).returning();
    const [flow] = await db.insert(schema.flow).values({ name: "Plan", updatedByEmail: "x@test" }).returning();
    const files = [sealAttachment({ name: "spec.pdf", data: Buffer.from("one") }, SECRET), sealAttachment({ name: "shot.png", data: Buffer.from("two") }, SECRET)];

    const started = await startBatch(
      db,
      {
        flowId: flow!.id,
        flowSnapshot: { name: "Plan", nodes: [], edges: [] } as never,
        starter: { id: ann!.id, email: ann!.email },
        machineId: mine!.id,
        extraInstructions: "",
        ticketIds: [],
        direct: [{ projectId: project!.id, title: "Plan", input: { type: "plan", value: "Do it" }, attachments: files }],
      },
      now,
    );
    if (!started.ok) throw new Error("not started");
    const runId = started.runIds[0]!;

    const listed = await attachmentsOfRun(db, runId);
    expect(listed.map((a) => [a.name, a.size, a.delivered])).toEqual([
      ["shot.png", 3, false],
      ["spec.pdf", 3, false],
    ]);
    const first = listed[1]!;
    const served = await attachmentForMachine(db, first.id, mine!.id);
    expect(served && openAttachment(served.sealed, SECRET)?.toString()).toBe("one");
    expect(await attachmentForMachine(db, first.id, other!.id)).toBeNull();
    expect(await attachmentForMachine(db, "not-an-id", mine!.id)).toBeNull();

    await markAttachmentsDelivered(db, runId, now);
    expect((await attachmentsOfRun(db, runId)).map((a) => [a.name, a.sha256, a.delivered])).toEqual([
      ["shot.png", sha256Hex(Buffer.from("two")), true],
      ["spec.pdf", sha256Hex(Buffer.from("one")), true],
    ]);
    expect(await attachmentForMachine(db, first.id, mine!.id)).toBeNull();
  });
});
