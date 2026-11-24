import { isActive, type Repository } from "@clauderon/core";
import {
  enableProject,
  getRunContext,
  isOperator,
  listTicketsWithRuns,
  listProjects,
  openTicketsMissingFrom,
  recordSync,
  removeProject,
  runsWithPullRequests,
  setPullRequestState,
  setTicketIssue,
  upsertTickets,
  type EnableResult,
  type RemoveProjectResult,
} from "@clauderon/db";
import type { AppDeps, Viewer } from "./deps";

// Projects and Sync (spec M1 §3). Sync runs in the background after the
// Tickets page renders; it never starts a Run and never writes to GitHub (TIC-9).

const PR_REFRESH_MS = 60_000;

/** The Projects page: each Project with its open Tickets and Active Runs. */
export async function viewProjects(deps: AppDeps) {
  const [projects, tickets] = await Promise.all([listProjects(deps.db), listTicketsWithRuns(deps.db)]);
  return projects.map((p) => {
    const own = tickets.filter((t) => t.projectId === p.id);
    return {
      ...p,
      openTickets: own.filter((t) => t.issueState === "open").length,
      activeRuns: own.flatMap((t) => t.runs).filter((r) => isActive(r.state)).length,
    };
  });
}

/**
 * Repositories the app token reads, minus enabled ones, of the Projects' owner once one exists (PRJ-2).
 * Deliberately not per Member or Machine: the app cannot see a `gh` login's access before a repository
 * is a Project (spec M1 §3.1, issue #89).
 */
export async function enableableRepositories(deps: AppDeps): Promise<Repository[]> {
  const [repos, projects] = await Promise.all([deps.github.listRepositories(), listProjects(deps.db)]);
  const enabled = new Set(projects.map((p) => `${p.owner}/${p.repo}`.toLowerCase()));
  const owner = projects[0]?.owner.toLowerCase();
  return repos
    .filter((r) => !enabled.has(`${r.owner}/${r.repo}`.toLowerCase()) && (!owner || r.owner.toLowerCase() === owner))
    .sort((a, b) => `${a.owner}/${a.repo}`.localeCompare(`${b.owner}/${b.repo}`));
}

export type EnableRepositoryResult = EnableResult | { ok: false; reason: "not-readable" | "no-branch" };

/** Only an Operator enables or removes a Project; every Member reads them. */
export const canManageProjects = (deps: AppDeps, viewer: Viewer) => isOperator(viewer.email, deps.operators);

/** Enable a repository with its base branch (PRJ-1). */
export async function enableRepository(
  deps: AppDeps,
  viewer: Viewer,
  input: { owner: string; repo: string; baseBranch: string },
): Promise<EnableRepositoryResult | "not-found"> {
  if (!canManageProjects(deps, viewer)) return "not-found";
  const repos = await deps.github.listRepositories();
  const repository = repos.find((r) => r.owner === input.owner && r.repo === input.repo);
  if (!repository) return { ok: false, reason: "not-readable" };
  const branches = await deps.github.listBranches(repository.owner, repository.repo);
  if (!branches.includes(input.baseBranch)) return { ok: false, reason: "no-branch" };
  return enableProject(deps.db, viewer.email, { owner: repository.owner, repo: repository.repo, baseBranch: input.baseBranch });
}

/** Remove a Project with its Tickets and ended Runs; refused while it has Active Runs. */
export async function removeRepository(deps: AppDeps, viewer: Viewer, projectId: string): Promise<RemoveProjectResult | "not-found"> {
  if (!canManageProjects(deps, viewer)) return "not-found";
  return removeProject(deps.db, viewer.email, projectId);
}

type SyncResult = { ok: true; summary: { added: number; updated: number; closed: number } } | { ok: false; error: string };

const SYNC_THROTTLE_MS = 60_000;
const PR_LOOKUP_LIMIT = 5;
// Last attempt per Project in this process, so a Project that keeps failing is not retried on every visit.
const lastAttempt = new Map<string, number>();

/**
 * Sync (TIC-5) every Project that was not synced in the last minute: upsert
 * every open issue, read the state of every known Ticket that did not come back
 * open, and refresh every recorded pull request that is not merged or closed.
 * Called in the background after the Tickets page rendered, never in its render
 * path. Not audited (no one asked for it); a failure stays on its Project and
 * the Tickets page shows it over the last synced Tickets. Returns whether any
 * Project was synced.
 */
export async function syncAllProjects(deps: AppDeps): Promise<boolean> {
  const now = deps.clock.now().getTime();
  const due = (await listProjects(deps.db)).filter((p) => {
    const last = Math.max(p.lastSyncedAt?.getTime() ?? 0, lastAttempt.get(p.id) ?? 0);
    return now - last >= SYNC_THROTTLE_MS;
  });
  for (const p of due) lastAttempt.set(p.id, now);
  await Promise.all(due.map((p) => pullFromGitHub(deps, p)));
  return due.length > 0;
}

/** Lets every Project be read again at once, as after the GitHub token changed. */
export function forgetSyncAttempts(): void {
  lastAttempt.clear();
}

/** Runs `task` over `items`, at most `limit` at a time. */
async function mapLimit<T>(items: T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await task(items[next++]!);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

async function pullFromGitHub(deps: AppDeps, project: { id: string; owner: string; repo: string }): Promise<SyncResult> {
  const now = deps.clock.now();
  try {
    const issues = await deps.github.listOpenIssues(project.owner, project.repo);
    const { added, updated } = await upsertTickets(deps.db, project.id, issues, now);

    const missing = await openTicketsMissingFrom(
      deps.db,
      project.id,
      issues.map((i) => i.number),
    );
    let closed = 0;
    for (const ticket of missing) {
      const issue = await deps.github.getIssue(project.owner, project.repo, ticket.number);
      await setTicketIssue(deps.db, ticket.id, issue, now);
      if (!issue || issue.state === "closed") closed++;
    }

    await mapLimit(await runsWithPullRequests(deps.db, project.id), PR_LOOKUP_LIMIT, async (run) => {
      const pr = await deps.github.findPullRequest(project.owner, project.repo, run.branch);
      if (pr) await setPullRequestState(deps.db, run.id, pr.state, now);
    });

    const summary = { added, updated, closed };
    await recordSync(deps.db, project.id, { summary }, now);
    return { ok: true, summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordSync(deps.db, project.id, { error: message }, now);
    return { ok: false, error: message };
  }
}

/** Refreshes a Run's pull request state when its page opens, at most once a minute (TIC-6). */
export async function refreshPullRequest(deps: AppDeps, runId: string): Promise<void> {
  const ctx = await getRunContext(deps.db, runId);
  const run = ctx?.run;
  if (!ctx || !run?.pullRequestNumber || !run.branch) return;
  const now = deps.clock.now();
  if (run.pullRequestCheckedAt && now.getTime() - run.pullRequestCheckedAt.getTime() < PR_REFRESH_MS) return;
  try {
    const pr = await deps.github.findPullRequest(ctx.project.owner, ctx.project.repo, run.branch);
    if (pr) await setPullRequestState(deps.db, run.id, pr.state, now);
  } catch {
    // The page still renders with the last known state.
  }
}
