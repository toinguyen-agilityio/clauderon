import { and, asc, desc, eq, gt, inArray, lt, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import {
  retryLogLines,
  snapshotFlow,
  tailLines,
  topologicalOrder,
  type FlowSnapshot,
  type HumanResponse,
  type OutputValue,
  type RetryContext,
  type RunState,
} from "@clauderon/core";
import type { Db } from "./client";
import { recordAudit } from "./access";
import { attempt, batch, flow, humanRequest, logChunk, member, output, machine, project, run, ticket } from "./schema";

// Batches, Runs, Attempts, Outputs and logs (spec M1 §4, §5). The Gateway's
// Run engine writes them; the web app reads them.

export type Run = typeof run.$inferSelect;
export type Attempt = typeof attempt.$inferSelect;
export type LogStream = (typeof logChunk.$inferSelect)["stream"];

export type StartBatchInput = {
  flowId: string;
  flowSnapshot: FlowSnapshot;
  starter: { id: string; email: string };
  machineId: string;
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
            machineId: input.machineId,
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

export async function runsOfMachine(db: Db, machineId: string, states: readonly RunState[]) {
  return db
    .select({ id: run.id, state: run.state, mode: run.mode, queuedAt: run.queuedAt, branch: run.branch, worktreePath: run.worktreePath, pendingRetry: run.pendingRetry })
    .from(run)
    .where(and(eq(run.machineId, machineId), inArray(run.state, [...states])));
}

/** Ended Real Runs of a Machine that still have a worktree to remove (RUN-14): Succeeded or Cancelled only. */
export async function runsToCleanUp(db: Db, machineId: string) {
  return db
    .select({ id: run.id })
    .from(run)
    .where(and(eq(run.machineId, machineId), eq(run.mode, "real"), inArray(run.state, ["succeeded", "cancelled"]), isNotNull(run.worktreePath)));
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

export type CancelRunResult =
  | { ok: true; machineId: string | null; from: RunState; cancelledAttemptIds: string[] }
  | { ok: false; reason: "not-found" | "ended" };

/**
 * Cancel (RUN-8, spec M3 §5): ends any Active Run as `cancelled` at once, with
 * its running or waiting Attempt, and closes an open `human_request`. The
 * Gateway kills the cancelled Attempts afterwards without waiting for them.
 */
export async function cancelRun(db: Db, runId: string, actorEmail: string, now: Date): Promise<CancelRunResult> {
  if (!/^[0-9a-f-]{36}$/i.test(runId)) return { ok: false, reason: "not-found" };
  return db.transaction(async (tx) => {
    const [current] = await tx.select({ state: run.state, machineId: run.machineId }).from(run).where(eq(run.id, runId)).for("update");
    if (!current) return { ok: false, reason: "not-found" } as const;
    if (current.state === "succeeded" || current.state === "cancelled") return { ok: false, reason: "ended" } as const;
    await tx.update(run).set({ state: "cancelled", endedAt: now }).where(eq(run.id, runId));
    const cancelled = await tx
      .update(attempt)
      .set({ state: "cancelled", endedAt: now, error: "Cancelled" })
      .where(and(eq(attempt.runId, runId), inArray(attempt.state, ["running", "waiting_for_human"])))
      .returning({ id: attempt.id });
    const cancelledAttemptIds = cancelled.map((a) => a.id);
    if (cancelledAttemptIds.length > 0) {
      await tx
        .update(humanRequest)
        .set({ respondedByEmail: actorEmail, respondedAt: now, response: { cancelled: true } })
        .where(and(inArray(humanRequest.attemptId, cancelledAttemptIds), isNull(humanRequest.respondedAt)));
    }
    await recordAudit(tx, { actorEmail, action: "run.cancel", subjectType: "run", subjectId: runId, detail: { from: current.state } });
    return { ok: true, machineId: current.machineId, from: current.state, cancelledAttemptIds } as const;
  });
}

export type RetryResult =
  | { ok: true; machineId: string; context: RetryContext }
  | { ok: false; reason: "not-found" | "not-retryable" | "unknown-node" | "after-failure" | "no-machine" };

/**
 * What a retried Node is told (RUN-7): the Run's latest Reject feedback, why
 * the failed Node failed with its last log lines, and the note.
 */
export async function buildRetryContext(db: Db, runId: string, note: string, retriedBy: string): Promise<RetryContext> {
  const [r] = await db.select({ flowSnapshot: run.flowSnapshot }).from(run).where(eq(run.id, runId));
  const snapshot = r?.flowSnapshot as FlowSnapshot | undefined;

  const [rejected] = await db
    .select({ response: humanRequest.response })
    .from(humanRequest)
    .innerJoin(attempt, eq(attempt.id, humanRequest.attemptId))
    .where(and(eq(attempt.runId, runId), eq(humanRequest.kind, "approve"), sql`${humanRequest.response}->>'decision' = 'reject'`))
    .orderBy(desc(humanRequest.respondedAt))
    .limit(1);
  const feedback = (rejected?.response as Extract<HumanResponse, { decision: "reject" }> | undefined)?.feedback ?? null;

  const [failed] = await db
    .select()
    .from(attempt)
    .where(and(eq(attempt.runId, runId), eq(attempt.superseded, false), inArray(attempt.state, ["failed", "interrupted"])))
    .orderBy(desc(attempt.endedAt), desc(attempt.startedAt))
    .limit(1);
  let failure: RetryContext["failure"] = null;
  if (failed) {
    const node = snapshot?.nodes.find((n) => n.id === failed.flowNodeId);
    const n = retryLogLines(node?.kind ?? "agent");
    const chunks = await db
      .select({ text: logChunk.text })
      .from(logChunk)
      .where(eq(logChunk.attemptId, failed.id))
      .orderBy(desc(logChunk.seq))
      .limit(n);
    const lastLines = tailLines(chunks.reverse().map((c) => c.text).join("\n"), n);
    failure = { node: node?.name ?? failed.flowNodeId, exitCode: failed.exitCode, error: failed.error, lastLines };
  }
  return { feedback, failure, note: note.trim() || null, retriedBy };
}

/** The Nodes a Retry from `flowNodeId` runs again: it and every later one in topological order. */
export function nodesFrom(snapshot: FlowSnapshot, flowNodeId: string): string[] {
  const order = topologicalOrder(snapshotFlow(snapshot).flow);
  const at = order.indexOf(flowNodeId);
  return at < 0 ? [] : order.slice(at);
}

/**
 * The Nodes a Retry may start from: the Node that failed (or was
 * interrupted) in the current pass and every Node before it. A later Node
 * would run with that Node still not succeeded, and it may be an Approve Node:
 * retrying past it would skip a person's decision.
 */
export function retryableNodes(snapshot: FlowSnapshot, current: readonly { flowNodeId: string; state: string }[]): string[] {
  const order = topologicalOrder(snapshotFlow(snapshot).flow);
  const stopped = new Set(current.filter((a) => a.state === "failed" || a.state === "interrupted").map((a) => a.flowNodeId));
  const at = order.findIndex((id) => stopped.has(id));
  return at < 0 ? order : order.slice(0, at + 1);
}

/**
 * Retry from a Node (RUN-7, spec M3 §4): any Member, on a Failed or
 * Interrupted Run. Later Nodes' Attempts are superseded but kept; the Run
 * joins the end of its Machine's queue with the retry context waiting for the
 * chosen Node. A Real Retry checks the logins again before it continues.
 */
export async function retryRun(db: Db, runId: string, flowNodeId: string, note: string, actorEmail: string, now: Date): Promise<RetryResult> {
  if (!/^[0-9a-f-]{36}$/i.test(runId)) return { ok: false, reason: "not-found" };
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(run).where(eq(run.id, runId)).for("update");
    if (!current) return { ok: false, reason: "not-found" } as const;
    if (current.state !== "failed" && current.state !== "interrupted") return { ok: false, reason: "not-retryable" } as const;
    if (!current.machineId) return { ok: false, reason: "no-machine" } as const;
    const snapshot = current.flowSnapshot as FlowSnapshot;
    const node = snapshot.nodes.find((n) => n.id === flowNodeId);
    const again = nodesFrom(snapshot, flowNodeId);
    if (!node || again.length === 0) return { ok: false, reason: "unknown-node" } as const;
    const pass = await tx
      .select({ flowNodeId: attempt.flowNodeId, state: attempt.state })
      .from(attempt)
      .where(and(eq(attempt.runId, runId), eq(attempt.superseded, false)));
    if (!retryableNodes(snapshot, pass).includes(flowNodeId)) return { ok: false, reason: "after-failure" } as const;

    const context = await buildRetryContext(tx, runId, note, actorEmail);
    await tx
      .update(attempt)
      .set({ superseded: true })
      .where(and(eq(attempt.runId, runId), inArray(attempt.flowNodeId, again)));
    await tx
      .update(run)
      .set({
        state: "queued",
        queuedAt: now,
        endedAt: null,
        failureReason: null,
        pendingRetry: { flowNodeId, context, loginsChecked: current.mode === "dry" },
      })
      .where(eq(run.id, runId));
    await recordAudit(tx, {
      actorEmail,
      action: "run.retry",
      subjectType: "run",
      subjectId: runId,
      detail: { from: current.state, node: node.name, flowNodeId, note: context.note },
    });
    return { ok: true, machineId: current.machineId, context } as const;
  });
}

/** A Real retried Run's login check passed: it may continue in its worktree. */
export async function markRetryLoginsChecked(db: Db, runId: string): Promise<void> {
  await db
    .update(run)
    .set({ pendingRetry: sql`jsonb_set(${run.pendingRetry}, '{loginsChecked}', 'true')` })
    .where(and(eq(run.id, runId), sql`${run.pendingRetry} is not null`));
}

/** Running Runs with their running Attempts, for the heartbeat watcher and recovery (RUN-12). */
export async function runningRuns(db: Db, machineId?: string) {
  const runs = await db
    .select({ id: run.id, machineId: run.machineId, mode: run.mode, branch: run.branch, worktreePath: run.worktreePath, pendingRetry: run.pendingRetry })
    .from(run)
    .where(machineId ? and(eq(run.state, "running"), eq(run.machineId, machineId)) : eq(run.state, "running"));
  if (runs.length === 0) return [];
  const attempts = await db
    .select({ id: attempt.id, runId: attempt.runId, state: attempt.state })
    .from(attempt)
    .where(and(inArray(attempt.runId, runs.map((r) => r.id)), inArray(attempt.state, ["running", "waiting_for_human"])));
  return runs.map((r) => ({ ...r, attemptIds: attempts.filter((a) => a.runId === r.id).map((a) => a.id) }));
}

/**
 * Interrupt a Running Run (RUN-12): it and its running Attempts become
 * `interrupted` with the reason; it keeps its worktree and waits for a person
 * to Retry or Cancel. Returns the interrupted Attempts, or null if the Run
 * was not running any more.
 */
export async function interruptRun(db: Db, runId: string, reason: string, now: Date): Promise<string[] | null> {
  return db.transaction(async (tx) => {
    const moved = await tx
      .update(run)
      .set({ state: "interrupted", endedAt: now, failureReason: reason })
      .where(and(eq(run.id, runId), eq(run.state, "running")))
      .returning({ id: run.id });
    if (moved.length === 0) return null;
    const attempts = await tx
      .update(attempt)
      .set({ state: "interrupted", endedAt: now, error: reason })
      .where(and(eq(attempt.runId, runId), eq(attempt.state, "running")))
      .returning({ id: attempt.id });
    return attempts.map((a) => a.id);
  });
}

/** Which of these Attempts are running in the database. */
export async function runningAttemptIds(db: Db, attemptIds: readonly string[]): Promise<Set<string>> {
  const ids = attemptIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ id: attempt.id })
    .from(attempt)
    .where(and(inArray(attempt.id, ids), eq(attempt.state, "running")));
  return new Set(rows.map((r) => r.id));
}

/** Machines with Queued Runs. */
export async function machinesWithQueuedRuns(db: Db): Promise<string[]> {
  const rows = await db
    .selectDistinct({ machineId: run.machineId })
    .from(run)
    .where(and(eq(run.state, "queued"), sql`${run.machineId} is not null`));
  return rows.map((r) => r.machineId!);
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

export type NewAttempt = { runId: string; flowNodeId: string; number: number; startedAt: Date; retryContext?: RetryContext | null };

/**
 * A new running Attempt. When it is the Node a Retry chose, it takes the
 * Run's pending retry context and clears it (RUN-7).
 */
export async function createAttempt(db: Db, values: NewAttempt): Promise<Attempt> {
  return db.transaction(async (tx) => {
    const [r] = await tx.select({ pendingRetry: run.pendingRetry }).from(run).where(eq(run.id, values.runId)).for("update");
    const pending = r?.pendingRetry?.flowNodeId === values.flowNodeId ? r.pendingRetry : null;
    const [row] = await tx
      .insert(attempt)
      .values({ ...values, state: "running", retryContext: values.retryContext ?? pending?.context ?? null })
      .returning();
    if (pending) await tx.update(run).set({ pendingRetry: null }).where(eq(run.id, values.runId));
    return row!;
  });
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

/** Deletes Log chunks written before `cutoff` (NFR-5); returns how many went. */
export async function deleteLogChunksBefore(db: Db, cutoff: Date): Promise<number> {
  const deleted = await db.delete(logChunk).where(lt(logChunk.at, cutoff)).returning({ id: logChunk.id });
  return deleted.length;
}

export async function logChunksOf(db: Db, attemptId: string, afterSeq = -1) {
  return db
    .select({ seq: logChunk.seq, stream: logChunk.stream, text: logChunk.text, at: logChunk.at })
    .from(logChunk)
    .where(and(eq(logChunk.attemptId, attemptId), gt(logChunk.seq, afterSeq)))
    .orderBy(asc(logChunk.seq));
}

export type RunFilters = { state?: RunState; flowId?: string; machineId?: string };
export const RUNS_PAGE_SIZE = 25;

const runListColumns = {
  id: run.id,
  state: run.state,
  mode: run.mode,
  queuedAt: run.queuedAt,
  startedAt: run.startedAt,
  endedAt: run.endedAt,
  machineId: run.machineId,
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
  if (filters.machineId) conditions.push(eq(run.machineId, filters.machineId));
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

/**
 * Every Run that opened a pull request, newest first. Not paginated: the Pull
 * requests page matches them to GitHub's open pull requests.
 */
export async function listPullRequests(db: Db) {
  return db
    .select({ ...runListColumns, branch: run.branch, pullRequestUrl: run.pullRequestUrl, starterMemberId: run.starterMemberId })
    .from(run)
    .innerJoin(ticket, eq(ticket.id, run.ticketId))
    .innerJoin(project, eq(project.id, ticket.projectId))
    .innerJoin(flow, eq(flow.id, run.flowId))
    .innerJoin(member, eq(member.id, run.starterMemberId))
    .where(isNotNull(run.pullRequestNumber))
    .orderBy(desc(run.queuedAt), desc(run.id));
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
    .select({ run, ticket, project, starter: { email: member.email, name: member.name, pictureUrl: member.pictureUrl }, machineOwnerId: machine.memberId, machineName: machine.name, machineConnected: machine.connected })
    .from(run)
    .innerJoin(ticket, eq(ticket.id, run.ticketId))
    .innerJoin(project, eq(project.id, ticket.projectId))
    .innerJoin(member, eq(member.id, run.starterMemberId))
    .leftJoin(machine, eq(machine.id, run.machineId))
    .where(eq(run.id, runId));
  if (!row) return null;
  // Null once the Machine was removed.
  const [machineOwner] = row.machineOwnerId
    ? await db.select({ email: member.email, name: member.name }).from(member).where(eq(member.id, row.machineOwnerId))
    : [];
  return { ...row, snapshot: row.run.flowSnapshot as FlowSnapshot, machineOwner: machineOwner ?? null, attempts: await attemptsOfRun(db, runId) };
}
