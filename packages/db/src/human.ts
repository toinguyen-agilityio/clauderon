import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  checkAnswers,
  type ApproveSubject,
  type FlowSnapshot,
  type GrillAnswers,
  type GrillQuestion,
  type HumanResponse,
} from "@clauderon/core";
import type { Db } from "./client";
import { recordAudit } from "./access";
import { runProjectId, runTitle } from "./runs";
import { attempt, humanRequest, member, output, project, run, ticket } from "./schema";

// Human Nodes (spec M3 §2, §3): the Gateway asks, any Member responds. A
// response is one transaction that locks the Run and the request, so two
// Members responding at once cannot both win (RUN-5).

export type HumanRequest = typeof humanRequest.$inferSelect;

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export type AskHumanInput = {
  runId: string;
  attemptId: string;
  kind: "approve" | "grill";
  questions: GrillQuestion[] | ApproveSubject;
  /** The Claude session a Grill round resumes. */
  claudeSessionId?: string | null;
  now: Date;
};

/**
 * Puts a running Attempt and its Run in `waiting_for_human` with a new round
 * (RUN-4). The Run keeps its Slot. Returns the round, or null when the Run was
 * no longer running (cancelled or interrupted meanwhile).
 */
export async function askHuman(db: Db, input: AskHumanInput): Promise<number | null> {
  return db.transaction(async (tx) => {
    const [current] = await tx.select({ state: run.state }).from(run).where(eq(run.id, input.runId)).for("update");
    if (current?.state !== "running") return null;
    const moved = await tx
      .update(attempt)
      .set({ state: "waiting_for_human", ...(input.claudeSessionId !== undefined ? { claudeSessionId: input.claudeSessionId } : {}) })
      .where(and(eq(attempt.id, input.attemptId), eq(attempt.state, "running")))
      .returning({ id: attempt.id });
    if (moved.length === 0) return null;
    const [{ rounds } = { rounds: 0 }] = await tx
      .select({ rounds: sql<number>`count(*)::int` })
      .from(humanRequest)
      .where(eq(humanRequest.attemptId, input.attemptId));
    await tx.insert(humanRequest).values({ attemptId: input.attemptId, kind: input.kind, round: rounds + 1, questions: input.questions, createdAt: input.now });
    await tx.update(run).set({ state: "waiting_for_human" }).where(eq(run.id, input.runId));
    return rounds + 1;
  });
}

export type HumanAction = { decision: "approve" } | { decision: "reject"; feedback: string } | { decision: "answer"; answers: GrillAnswers };

export type RespondResult =
  | { ok: true; runId: string; machineId: string | null; decision: HumanAction["decision"] }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "answered"; by: string; cancelled: boolean }
  | { ok: false; reason: "invalid"; error: string };

const AUDIT_ACTION = { approve: "run.approve", reject: "run.reject", answer: "run.answer" } as const;

/**
 * Approve, Reject or Answer an open request (spec M3 §2, MEM-2): any Member.
 * The first response wins; a later one learns who answered.
 */
export async function respondToHuman(db: Db, requestId: string, actorEmail: string, action: HumanAction, now: Date): Promise<RespondResult> {
  if (!isUuid(requestId)) return { ok: false, reason: "not-found" };
  return db.transaction(async (tx) => {
    const [found] = await tx
      .select({ runId: attempt.runId })
      .from(humanRequest)
      .innerJoin(attempt, eq(attempt.id, humanRequest.attemptId))
      .where(eq(humanRequest.id, requestId));
    if (!found) return { ok: false, reason: "not-found" } as const;
    // Run first, as Cancel does, so the two never wait on each other.
    const [r] = await tx.select().from(run).where(eq(run.id, found.runId)).for("update");
    const [request] = await tx.select().from(humanRequest).where(eq(humanRequest.id, requestId)).for("update");
    const [a] = await tx.select().from(attempt).where(eq(attempt.id, request!.attemptId));
    if (!r || !request || !a) return { ok: false, reason: "not-found" } as const;

    if (request.respondedAt || r.state !== "waiting_for_human" || a.state !== "waiting_for_human") {
      const email = request.respondedByEmail;
      const [who] = email ? await tx.select({ name: member.name }).from(member).where(eq(member.email, email)) : [];
      const cancelled = r.state === "cancelled" || (request.response as { cancelled?: boolean } | null)?.cancelled === true;
      return { ok: false, reason: "answered", by: who?.name ?? email ?? "someone else", cancelled } as const;
    }

    const snapshot = r.flowSnapshot as FlowSnapshot;
    const node = snapshot.nodes.find((n) => n.id === a.flowNodeId);
    let response: HumanResponse;
    if (request.kind === "approve") {
      if (action.decision === "answer") return { ok: false, reason: "invalid", error: "This Node asks for Approve or Reject." } as const;
      if (action.decision === "reject") {
        const feedback = action.feedback.trim();
        if (!feedback) return { ok: false, reason: "invalid", error: "Reject needs feedback for the next try." } as const;
        response = { decision: "reject", feedback };
      } else {
        response = { decision: "approve" };
      }
    } else {
      if (action.decision !== "answer") return { ok: false, reason: "invalid", error: "This Node asks for answers." } as const;
      const checked = checkAnswers((request.questions ?? []) as GrillQuestion[], action.answers);
      if (!checked.ok) return { ok: false, reason: "invalid", error: checked.error } as const;
      response = { decision: "answer", answers: checked.answers };
    }

    await tx.update(humanRequest).set({ response, respondedByEmail: actorEmail, respondedAt: now }).where(eq(humanRequest.id, requestId));
    if (response.decision === "approve") {
      // The input passes through unchanged as the Output of the same type (FLW-2).
      const input = (request.questions as ApproveSubject | null)?.input ?? null;
      const out = node?.outputs.find((o) => o.type === input?.type) ?? node?.outputs[0];
      await tx.update(attempt).set({ state: "succeeded", endedAt: now }).where(eq(attempt.id, a.id));
      if (input && out) await tx.insert(output).values({ attemptId: a.id, name: out.name, type: out.type, value: input.value as object });
      await tx.update(run).set({ state: "running" }).where(eq(run.id, r.id));
    } else if (response.decision === "reject") {
      const reason = `Rejected at “${node?.name ?? "Approve"}”: ${response.feedback}`;
      await tx.update(attempt).set({ state: "failed", endedAt: now, error: `Rejected: ${response.feedback}` }).where(eq(attempt.id, a.id));
      await tx.update(run).set({ state: "failed", endedAt: now, failureReason: reason }).where(eq(run.id, r.id));
    } else {
      await tx.update(attempt).set({ state: "running" }).where(eq(attempt.id, a.id));
      await tx.update(run).set({ state: "running" }).where(eq(run.id, r.id));
    }
    await recordAudit(tx, {
      actorEmail,
      action: AUDIT_ACTION[response.decision],
      subjectType: "run",
      subjectId: r.id,
      detail: {
        node: node?.name ?? a.flowNodeId,
        round: request.round,
        ...(response.decision === "reject" ? { feedback: response.feedback } : {}),
      },
    });
    return { ok: true, runId: r.id, machineId: r.machineId, decision: response.decision } as const;
  });
}

/** Every request of a Run, oldest first: rounds and responses for the Run page (spec M3 §8). */
export async function humanRequestsOfRun(db: Db, runId: string): Promise<HumanRequest[]> {
  if (!isUuid(runId)) return [];
  return db
    .select({ request: humanRequest })
    .from(humanRequest)
    .innerJoin(attempt, eq(attempt.id, humanRequest.attemptId))
    .where(eq(attempt.runId, runId))
    .orderBy(asc(humanRequest.createdAt), asc(humanRequest.round))
    .then((rows) => rows.map((r) => r.request));
}

/** The open request of a waiting Attempt, if any. */
export async function openRequestOf(db: Db, attemptId: string): Promise<HumanRequest | null> {
  const [row] = await db
    .select()
    .from(humanRequest)
    .where(and(eq(humanRequest.attemptId, attemptId), isNull(humanRequest.respondedAt)))
    .orderBy(asc(humanRequest.round));
  return row ?? null;
}

const openCondition = and(isNull(humanRequest.respondedAt), eq(attempt.state, "waiting_for_human"));

/** Needs you (RUN-5): every open request across all Runs, oldest first. */
export async function openHumanRequests(db: Db) {
  const rows = await db
    .select({
      request: humanRequest,
      flowNodeId: attempt.flowNodeId,
      runId: run.id,
      flowSnapshot: run.flowSnapshot,
      ticketNumber: ticket.number,
      ticketTitle: runTitle,
      ticketUrl: ticket.url,
      projectId: project.id,
      starterEmail: member.email,
      starterName: member.name,
      starterPicture: member.pictureUrl,
    })
    .from(humanRequest)
    .innerJoin(attempt, eq(attempt.id, humanRequest.attemptId))
    .innerJoin(run, eq(run.id, attempt.runId))
    .leftJoin(ticket, eq(ticket.id, run.ticketId))
    .innerJoin(project, eq(project.id, runProjectId))
    .innerJoin(member, eq(member.id, run.starterMemberId))
    .where(and(openCondition, eq(run.state, "waiting_for_human")))
    .orderBy(asc(humanRequest.createdAt), asc(humanRequest.id));
  return rows.map(({ flowSnapshot, ...r }) => {
    const snapshot = flowSnapshot as FlowSnapshot;
    const node = snapshot.nodes.find((n) => n.id === r.flowNodeId);
    return { ...r, flowName: snapshot.name, nodeName: node?.name ?? "?", nodeInstructions: node?.instructions ?? "" };
  });
}

/** The count in the navigation (spec M3 §3): same joins and filter as the list, so they always agree. */
export async function countOpenHumanRequests(db: Db): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(humanRequest)
    .innerJoin(attempt, eq(attempt.id, humanRequest.attemptId))
    .innerJoin(run, eq(run.id, attempt.runId))
    .leftJoin(ticket, eq(ticket.id, run.ticketId))
    .innerJoin(project, eq(project.id, runProjectId))
    .innerJoin(member, eq(member.id, run.starterMemberId))
    .where(and(openCondition, eq(run.state, "waiting_for_human")));
  return row?.n ?? 0;
}

/** The answered Grill rounds of an Attempt, newest last, for the Gateway's resume. */
export async function latestAnsweredRound(db: Db, attemptId: string): Promise<HumanRequest | null> {
  const rows = await db
    .select()
    .from(humanRequest)
    .where(and(eq(humanRequest.attemptId, attemptId), inArray(humanRequest.kind, ["grill"])))
    .orderBy(asc(humanRequest.round));
  const last = rows.at(-1);
  return last?.respondedAt ? last : null;
}
