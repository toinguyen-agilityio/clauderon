import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { appendLogChunk, createAttempt, logChunksOf, schema, sql, type Db } from "@clauderon/db";
import { FakeClock, createTestDatabase, memberRow, machineRow, projectRow, startSampleBatch, ticketRow, type TestDatabase } from "@clauderon/testing";
import { LOG_RETENTION_DAYS, LogRetention } from "../src/log-retention";

let test: TestDatabase;
let db: Db;
const DAY = 86_400_000;

beforeAll(async () => {
  test = await createTestDatabase();
  db = test.db;
});
afterAll(() => test.drop());
beforeEach(async () => {
  await db.execute(sql`truncate member, machine, project, ticket, batch, run, attempt, log_chunk cascade`);
});

async function attemptId(now: Date): Promise<string> {
  const member = await memberRow(db, "ann@example.com", "Ann");
  const machine = await machineRow(db, member.id);
  const project = await projectRow(db);
  const ticket = await ticketRow(db, project.id, 1);
  const started = await startSampleBatch(db, member, machine.id, [ticket.id], now);
  if (!started.ok) throw new Error("batch not started");
  const [node] = await db.select({ id: schema.flowNode.id }).from(schema.flowNode).limit(1);
  const attempt = await createAttempt(db, { runId: started.runIds[0]!, flowNodeId: node!.id, number: 1, startedAt: now });
  return attempt.id;
}

const log = (id: string, seq: number, at: Date) => appendLogChunk(db, { attemptId: id, seq, stream: "stdout", text: `line ${seq}`, at });

describe("Log retention (NFR-5)", () => {
  it("deletes Log chunks older than 90 days when it starts and keeps newer ones", async () => {
    const clock = new FakeClock();
    const now = clock.now();
    const id = await attemptId(now);
    await log(id, 0, new Date(now.getTime() - (LOG_RETENTION_DAYS + 1) * DAY));
    await log(id, 1, new Date(now.getTime() - (LOG_RETENTION_DAYS - 1) * DAY));

    const retention = new LogRetention({ db, clock, log: () => {} });
    await retention.start();

    expect((await logChunksOf(db, id)).map((c) => c.seq)).toEqual([1]);
    retention.stop();
  });

  it("runs again every day", async () => {
    const clock = new FakeClock();
    const now = clock.now();
    const id = await attemptId(now);
    const retention = new LogRetention({ db, clock, log: () => {} });
    await retention.start();
    await log(id, 0, new Date(now.getTime() - (LOG_RETENTION_DAYS - 0.5) * DAY));

    await clock.advance(DAY);
    await retention.idle();

    expect(await logChunksOf(db, id)).toEqual([]);
    expect(clock.pending()).toEqual([DAY]);
    retention.stop();
  });
});
