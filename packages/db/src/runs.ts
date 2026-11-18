import { and, asc, desc, eq, gt, inArray, sql, type SQL } from "drizzle-orm";
import type { FlowSnapshot, OutputValue, RunState } from "@clauderon/core";
import type { Db } from "./client";
import { recordAudit } from "./access";
import { attempt, batch, flow, logChunk, member, output, pod, project, run, ticket } from "./schema";

// Batches, Runs, Attempts, Outputs and logs (spec M1 §4, §5). The Gateway's
// Run engine writes them; the web app reads them.

export type Run = typeof run.$inferSelect;
export type Attempt = typeof attempt.$inferSelect;
export type LogStream = (typeof logChunk.$inferSelect)["stream"];

export type StartBatchInput = {
  flowId: string;
  flowSnapshot: FlowSnapshot;
  starter: { id: string; email: string };
  podId: string;
  mode: "real" | "dry";
  extraInstructions: string;
  ticketIds: readonly string[];
};

export type StartBatchResult = { ok: true; batchId: string; runIds: string[] } | { ok: false; reason: "active-run"; ticketId: string; runId: string | null };

/** Postgres' unique violation, wrapped or not by the driver layer. */
function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: unknown }).code === "23505") return true;
  }
  return false;
}

async function activeRealRun(db: Db, ticketIds: readonly string[]) {
  const [row] = await db
    .select({ id: run.id, ticketId: run.ticketId })
    .from(run)
    .where(and(inArray(run.ticketId, [...ticketIds]), eq(run.mode, "real"), sql`${run.state} not in ('succeeded', 'cancelled')`))
    .limit(1);
  return row ?? null;
}

/**
 * One Batch and one queued Run per Ticket, in one transaction (RUN-1). A
 * Ticket with an Active Real Run fails the whole Start (TIC-7); the partial
 * unique index catches one gained meanwhile.
 */
export async function startBatch(db: Db, input: StartBatchInput, now: Date): Promise<StartBatchResult> {
  if (input.mode === "real") {
    const active = await activeRealRun(db, input.ticketIds);
    if (active) return { ok: false, reason: "active-run", ticketId: active.ticketId, runId: active.id };
  }
  try {
    return await db.transaction(async (tx) => {
      const [b] = await tx
        .insert(batch)
        .values({ flowId: input.flowId, starterMemberId: input.starter.id, mode: input.mode, extraInstructions: input.extraInstructions })
        .returning({ id: batch.id });
      const runIds: string[] = [];
      // Queued in selection order, a millisecond apart, so the queue keeps it.
      for (const [i, ticketId] of input.ticketIds.entries()) {
        const [r] = await tx
          .insert(run)
          .values({
            batchId: b!.id,
            ticketId,
            flowId: input.flowId,
            flowSnapshot: input.flowSnapshot,
            podId: input.podId,
            starterMemberId: input.starter.id,
            mode: input.mode,
            state: "queued",
            queuedAt: new Date(now.getTime() + i),
          })
          .returning({ id: run.id });
        runIds.push(r!.id);
        await recordAudit(tx, { actorEmail: input.starter.email, action: "run.start", subjectType: "run", subjectId: r!.id, detail: { ticketId, batchId: b!.id } });
      }
      return { ok: true, batchId: b!.id, runIds } as const;
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const active = await activeRealRun(db, input.ticketIds);
    return { ok: false, reason: "active-run", ticketId: active?.ticketId ?? input.ticketIds[0]!, runId: active?.id ?? null };
  }
}

export async function getRun(db: Db, runId: string): Promise<Run | null> {
  if (!/^[0-9a-f-]{36}$/i.test(runId)) return null;
  const [row] = await db.select().from(run).where(eq(run.id, runId));
  return row ?? null;
}

/** A Run with what the engine needs to drive it. */
export async function getRunContext(db: Db, runId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(runId)) return null;
  const [row] = await db
    .select({ run, ticket, project, batchInstructions: batch.extraInstructions })
    .from(run)
    .innerJoin(ticket, eq(ticket.id, run.ticketId))
    .innerJoin(project, eq(project.id, ticket.projectId))
    .innerJoin(batch, eq(batch.id, run.batchId))
    .where(eq(run.id, runId));
  return row ? { ...row, snapshot: row.run.flowSnapshot as FlowSnapshot } : null;
}

export async function runsOfPod(db: Db, podId: string, states: readonly RunState[]) {
  return db
    .select({ id: run.id, state: run.state, mode: run.mode, queuedAt: run.queuedAt, branch: run.branch, worktreePath: run.worktreePath })
    .from(run)
    .where(and(eq(run.podId, podId), inArray(run.state, [...states])));
}

export async function updateRun(db: Db, runId: string, patch: Partial<Omit<Run, "id">>): Promise<void> {
  await db.update(run).set(patch).where(eq(run.id, runId));
}

/** Moves a Run only if it is still in `from`; returns whether it moved. */
export async function moveRun(db: Db, runId: string, from: RunState, patch: Partial<Omit<Run, "id">> & { state: RunState }): Promise<boolean> {
  const rows = await db
    .update(run)
    .set(patch)
    .where(and(eq(run.id, runId), eq(run.state, from)))
    .returning({ id: run.id });
  return rows.length > 0;
}

export type AttemptWithOutputs = Attempt & { outputs: (typeof output.$inferSelect)[] };

export async function attemptsOfRun(db: Db, runId: string): Promise<AttemptWithOutputs[]> {
  const attempts = await db.select().from(attempt).where(eq(attempt.runId, runId)).orderBy(asc(attempt.startedAt), asc(attempt.number));
  if (attempts.length === 0) return [];
  const outputs = await db
    .select()
    .from(output)
    .where(
      inArray(
        output.attemptId,
        attempts.map((a) => a.id),
      ),
    );
  return attempts.map((a) => ({ ...a, outputs: outputs.filter((o) => o.attemptId === a.id) }));
}

export async function getAttempt(db: Db, attemptId: string): Promise<Attempt | null> {
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return null;
  const [row] = await db.select().from(attempt).where(eq(attempt.id, attemptId));
  return row ?? null;
}

export async function createAttempt(db: Db, values: { runId: string; flowNodeId: string; number: number; startedAt: Date }): Promise<Attempt> {
  const [row] = await db
    .insert(attempt)
    .values({ ...values, state: "running" })
    .returning();
  return row!;
}

export type AttemptEnd = {
  state: "succeeded" | "failed";
  endedAt: Date;
  exitCode?: number | null;
  error?: string | null;
  claudeSessionId?: string | null;
  outputs?: readonly OutputValue[];
};

/** Ends a running Attempt with its Outputs; returns false if it had already ended. */
export async function finishAttempt(db: Db, attemptId: string, end: AttemptEnd): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(attempt)
      .set({ state: end.state, endedAt: end.endedAt, exitCode: end.exitCode ?? null, error: end.error ?? null, claudeSessionId: end.claudeSessionId ?? null })
      .where(and(eq(attempt.id, attemptId), eq(attempt.state, "running")))
      .returning({ id: attempt.id });
    if (rows.length === 0) return false;
    for (const o of end.outputs ?? []) await tx.insert(output).values({ attemptId, name: o.name, type: o.type, value: o.value as object });
    return true;
  });
}

export async function setAttemptUsage(db: Db, attemptId: string, usage: { inputTokens: number; outputTokens: number }): Promise<void> {
  await db.update(attempt).set(usage).where(eq(attempt.id, attemptId));
}

export async function appendLogChunk(db: Db, chunk: { attemptId: string; seq: number; stream: LogStream; text: string; at: Date }): Promise<void> {
  await db.insert(logChunk).values(chunk);
}

export async function logChunksOf(db: Db, attemptId: string, afterSeq = -1) {
  return db
    .select({ seq: logChunk.seq, stream: logChunk.stream, text: logChunk.text, at: logChunk.at })
    .from(logChunk)
    .where(and(eq(logChunk.attemptId, attemptId), gt(logChunk.seq, afterSeq)))
    .orderBy(asc(logChunk.seq));
}

export type RunFilters = { state?: RunState; flowId?: string; podId?: string };
export const RUNS_PAGE_SIZE = 25;

const runListColumns = {
  id: run.id,
  state: run.state,
  mode: run.mode,
  queuedAt: run.queuedAt,
  startedAt: run.startedAt,
  endedAt: run.endedAt,
  podId: run.podId,
  flowId: run.flowId,
  flowName: flow.name,
  ticketNumber: ticket.number,
  ticketTitle: ticket.title,
  projectId: project.id,
  starterEmail: member.email,
  starterName: member.name,
  starterPicture: member.pictureUrl,
  pullRequestNumber: run.pullRequestNumber,
  pullRequestState: run.pullRequestState,
};

/** The Runs list (TRK-7): filters combine; newest first; paginated. */
export async function listRuns(db: Db, filters: RunFilters, page = 1) {
  const conditions: SQL[] = [];
  if (filters.state) conditions.push(eq(run.state, filters.state));
  if (filters.flowId) conditions.push(eq(run.flowId, filters.flowId));
  if (filters.podId) conditions.push(eq(run.podId, filters.podId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select(runListColumns)
    .from(run)
    .innerJoin(ticket, eq(ticket.id, run.ticketId))
    .innerJoin(project, eq(project.id, ticket.projectId))
    .innerJoin(flow, eq(flow.id, run.flowId))
    .innerJoin(member, eq(member.id, run.starterMemberId))
    .where(where)
    .orderBy(desc(run.queuedAt), desc(run.id))
    .limit(RUNS_PAGE_SIZE + 1)
    .offset((Math.max(1, page) - 1) * RUNS_PAGE_SIZE);
  const [{ total } = { total: 0 }] = await db.select({ total: sql<number>`count(*)::int` }).from(run).where(where);
  return { rows: rows.slice(0, RUNS_PAGE_SIZE), hasMore: rows.length > RUNS_PAGE_SIZE, total };
}

/** How many Runs are in each state, for the Runs page's summary. */
export async function runStateCounts(db: Db): Promise<Partial<Record<RunState, number>>> {
  const rows = await db.select({ state: run.state, n: sql<number>`count(*)::int` }).from(run).groupBy(run.state);
  return Object.fromEntries(rows.map((r) => [r.state, r.n]));
}

/** Everything the Run page shows (TRK-1, TRK-2). */
export async function getRunView(db: Db, runId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(runId)) return null;
  const [row] = await db
    .select({ run, ticket, project, starter: { email: member.email, name: member.name, pictureUrl: member.pictureUrl }, podOwnerId: pod.memberId, podName: pod.name })
    .from(run)
    .innerJoin(ticket, eq(ticket.id, run.ticketId))
    .innerJoin(project, eq(project.id, ticket.projectId))
    .innerJoin(member, eq(member.id, run.starterMemberId))
    .leftJoin(pod, eq(pod.id, run.podId))
    .where(eq(run.id, runId));
  if (!row) return null;
  // Null once the Pod was removed (POD-7).
  const [podOwner] = row.podOwnerId
    ? await db.select({ email: member.email, name: member.name }).from(member).where(eq(member.id, row.podOwnerId))
    : [];
  return { ...row, snapshot: row.run.flowSnapshot as FlowSnapshot, podOwner: podOwner ?? null, attempts: await attemptsOfRun(db, runId) };
}
