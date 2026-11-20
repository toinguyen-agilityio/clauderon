import { and, asc, desc, eq, inArray, isNotNull, notExists, notInArray } from "drizzle-orm";
import type { Issue } from "@clauderon/core";
import type { Db } from "./client";
import { recordAudit } from "./access";
import { batch, project, run, ticket } from "./schema";

// Projects and Tickets (spec M1 §3). GitHub stays the source of truth: Sync
// only copies issues in, and Ticket Status is derived, never stored.

export type Project = typeof project.$inferSelect;
export type Ticket = typeof ticket.$inferSelect;

export async function listProjects(db: Db): Promise<Project[]> {
  return db.select().from(project).orderBy(asc(project.owner), asc(project.repo));
}

export async function getProject(db: Db, id: string): Promise<Project | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(project).where(eq(project.id, id));
  return row ?? null;
}

export type EnableResult = { ok: true; project: Project } | { ok: false; reason: "other-owner" | "exists" };

/** Enables a repository as a Project (PRJ-1); all Projects share one owner (PRJ-2). */
export async function enableProject(
  db: Db,
  actorEmail: string,
  repository: { owner: string; repo: string; baseBranch: string },
): Promise<EnableResult> {
  return db.transaction(async (tx) => {
    const [other] = await tx.select({ owner: project.owner }).from(project).limit(1);
    if (other && other.owner.toLowerCase() !== repository.owner.toLowerCase()) return { ok: false, reason: "other-owner" } as const;
    const [row] = await tx
      .insert(project)
      .values({ ...repository, enabledByEmail: actorEmail })
      .onConflictDoNothing()
      .returning();
    if (!row) return { ok: false, reason: "exists" } as const;
    await recordAudit(tx, {
      actorEmail,
      action: "project.enable",
      subjectType: "project",
      subjectId: row.id,
      detail: { repository: `${row.owner}/${row.repo}`, baseBranch: row.baseBranch },
    });
    return { ok: true, project: row } as const;
  });
}

export type RemoveProjectResult =
  | { ok: true; tickets: number; runs: number }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "active-runs"; activeRuns: number };

/**
 * Removes a Project with its Tickets and their Runs (Attempts, Outputs and
 * logs cascade). Refused while any of its Runs is Active. The Tickets are
 * locked first, so a Run started meanwhile waits and then fails on its
 * missing Ticket instead of outliving the Project.
 */
export async function removeProject(db: Db, actorEmail: string, projectId: string): Promise<RemoveProjectResult> {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return { ok: false, reason: "not-found" };
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(project).where(eq(project.id, projectId)).for("update");
    if (!row) return { ok: false, reason: "not-found" } as const;
    const tickets = await tx.select({ id: ticket.id }).from(ticket).where(eq(ticket.projectId, projectId)).for("update");
    const ticketIds = tickets.map((t) => t.id);
    const runs =
      ticketIds.length === 0 ? [] : await tx.select({ id: run.id, state: run.state, batchId: run.batchId }).from(run).where(inArray(run.ticketId, ticketIds));
    const activeRuns = runs.filter((r) => r.state !== "succeeded" && r.state !== "cancelled").length;
    if (activeRuns > 0) return { ok: false, reason: "active-runs", activeRuns } as const;

    if (runs.length > 0) {
      await tx.delete(run).where(inArray(run.ticketId, ticketIds));
      // A Batch may hold other Projects' Tickets; only the ones left empty go.
      const batchIds = [...new Set(runs.map((r) => r.batchId))];
      await tx.delete(batch).where(and(inArray(batch.id, batchIds), notExists(tx.select({ id: run.id }).from(run).where(eq(run.batchId, batch.id)))));
    }
    await tx.delete(ticket).where(eq(ticket.projectId, projectId));
    await tx.delete(project).where(eq(project.id, projectId));
    await recordAudit(tx, {
      actorEmail,
      action: "project.remove",
      subjectType: "project",
      subjectId: row.id,
      detail: { repository: `${row.owner}/${row.repo}`, tickets: ticketIds.length, runs: runs.length },
    });
    return { ok: true, tickets: ticketIds.length, runs: runs.length } as const;
  });
}

export type UpsertCounts = { added: number; updated: number };

/** Copies open issues into Tickets (TIC-5 step 1). */
export async function upsertTickets(db: Db, projectId: string, issues: readonly Issue[], now: Date): Promise<UpsertCounts> {
  if (issues.length === 0) return { added: 0, updated: 0 };
  const existing = await db
    .select({ number: ticket.number })
    .from(ticket)
    .where(
      and(
        eq(ticket.projectId, projectId),
        inArray(
          ticket.number,
          issues.map((i) => i.number),
        ),
      ),
    );
  const known = new Set(existing.map((t) => t.number));
  for (const issue of issues) {
    const values = {
      title: issue.title,
      body: issue.body,
      labels: issue.labels,
      authorLogin: issue.authorLogin,
      authorAssociation: issue.authorAssociation,
      issueState: issue.state,
      url: issue.url,
      syncedAt: now,
    };
    await db
      .insert(ticket)
      .values({ projectId, number: issue.number, ...values })
      .onConflictDoUpdate({ target: [ticket.projectId, ticket.number], set: values });
  }
  return { added: issues.filter((i) => !known.has(i.number)).length, updated: known.size };
}

/** Tickets Sync still thinks are open but did not come back open (TIC-5 step 2). */
export async function openTicketsMissingFrom(db: Db, projectId: string, openNumbers: readonly number[]): Promise<Ticket[]> {
  const conditions = [eq(ticket.projectId, projectId), eq(ticket.issueState, "open")];
  if (openNumbers.length > 0) conditions.push(notInArray(ticket.number, [...openNumbers]));
  return db
    .select()
    .from(ticket)
    .where(and(...conditions));
}

export async function setTicketIssue(db: Db, ticketId: string, issue: Issue | null, now: Date): Promise<void> {
  const values = issue
    ? { title: issue.title, body: issue.body, labels: issue.labels, issueState: issue.state, syncedAt: now }
    : // A deleted or transferred issue reads as closed.
      { issueState: "closed", syncedAt: now };
  await db.update(ticket).set(values).where(eq(ticket.id, ticketId));
}

export async function recordSync(
  db: Db,
  projectId: string,
  outcome: { summary: { added: number; updated: number; closed: number } } | { error: string },
  now: Date,
): Promise<void> {
  const values =
    "error" in outcome ? { syncError: outcome.error } : { syncError: null, syncSummary: outcome.summary, lastSyncedAt: now };
  await db.update(project).set(values).where(eq(project.id, projectId));
}

export type RunWithPullRequest = { id: string; branch: string; pullRequestNumber: number; pullRequestCheckedAt: Date | null };

/** Runs of a Project that recorded a pull request (TIC-5 step 3). */
export async function runsWithPullRequests(db: Db, projectId: string): Promise<RunWithPullRequest[]> {
  const rows = await db
    .select({ id: run.id, branch: run.branch, pullRequestNumber: run.pullRequestNumber, pullRequestCheckedAt: run.pullRequestCheckedAt })
    .from(run)
    .innerJoin(ticket, eq(ticket.id, run.ticketId))
    .where(and(eq(ticket.projectId, projectId), isNotNull(run.pullRequestNumber), isNotNull(run.branch)));
  return rows as RunWithPullRequest[];
}

export async function setPullRequestState(db: Db, runId: string, state: string, now: Date): Promise<void> {
  await db.update(run).set({ pullRequestState: state, pullRequestCheckedAt: now }).where(eq(run.id, runId));
}

export type TicketRunView = { id: string; mode: "real" | "dry"; state: (typeof run.$inferSelect)["state"]; queuedAt: Date; pullRequestState: string | null };
export type TicketWithRuns = Ticket & { runs: TicketRunView[] };

/** Tickets with their Runs, for the derived Ticket Status (TIC-6). */
export async function listTicketsWithRuns(db: Db, projectId?: string): Promise<TicketWithRuns[]> {
  const tickets = await db
    .select()
    .from(ticket)
    .where(projectId ? eq(ticket.projectId, projectId) : undefined)
    .orderBy(asc(ticket.projectId), desc(ticket.number));
  if (tickets.length === 0) return [];
  const runs = await db
    .select({ id: run.id, ticketId: run.ticketId, mode: run.mode, state: run.state, queuedAt: run.queuedAt, pullRequestState: run.pullRequestState })
    .from(run)
    .where(
      inArray(
        run.ticketId,
        tickets.map((t) => t.id),
      ),
    );
  const byTicket = new Map<string, TicketRunView[]>();
  for (const { ticketId, ...r } of runs) byTicket.set(ticketId, [...(byTicket.get(ticketId) ?? []), r]);
  return tickets.map((t) => ({ ...t, runs: byTicket.get(t.id) ?? [] }));
}

export async function getTickets(db: Db, ids: readonly string[]): Promise<Ticket[]> {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(ticket)
    .where(inArray(ticket.id, [...ids]));
}
