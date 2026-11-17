import { isActive, type Repository } from "@clauderon/core";
import {
  enableProject,
  getProject,
  getRunContext,
  listTicketsWithRuns,
  listProjects,
  openTicketsMissingFrom,
  recordAudit,
  recordSync,
  runsWithPullRequests,
  setPullRequestState,
  setTicketIssue,
  upsertTickets,
  type EnableResult,
} from "@clauderon/db";
import type { AppDeps, Viewer } from "./deps";

// Projects and Sync (spec M1 §3). Sync never starts a Run and never writes
// to GitHub (TIC-9).

const PR_REFRESH_MS = 60_000;

/** The Projects page: each Project with its open Tickets and Active Runs. */
export async function viewProjects(deps: AppDeps) {
  const [projects, tickets] = await Promise.all([listProjects(deps.db), listTicketsWithRuns(deps.db)]);
  return projects.map((p) => {
    const own = tickets.filter((t) => t.projectId === p.id);
    return {
      ...p,
      openTickets: own.filter((t) => t.issueState === "open").length,
      activeRuns: own.flatMap((t) => t.runs).filter((r) => r.mode === "real" && isActive(r.state)).length,
    };
  });
}

/** Repositories the token reads, minus enabled ones, of the Projects' owner once one exists (PRJ-2). */
export async function enableableRepositories(deps: AppDeps): Promise<Repository[]> {
  const [repos, projects] = await Promise.all([deps.github.listRepositories(), listProjects(deps.db)]);
  const enabled = new Set(projects.map((p) => `${p.owner}/${p.repo}`.toLowerCase()));
  const owner = projects[0]?.owner.toLowerCase();
  return repos
    .filter((r) => !enabled.has(`${r.owner}/${r.repo}`.toLowerCase()) && (!owner || r.owner.toLowerCase() === owner))
    .sort((a, b) => `${a.owner}/${a.repo}`.localeCompare(`${b.owner}/${b.repo}`));
}

export type EnableRepositoryResult = EnableResult | { ok: false; reason: "not-readable" | "no-branch" };

/** Enable a repository with its base branch (PRJ-1). */
export async function enableRepository(
  deps: AppDeps,
  viewer: Viewer,
  input: { owner: string; repo: string; baseBranch: string },
): Promise<EnableRepositoryResult> {
  const repos = await deps.github.listRepositories();
  const repository = repos.find((r) => r.owner === input.owner && r.repo === input.repo);
  if (!repository) return { ok: false, reason: "not-readable" };
  const branches = await deps.github.listBranches(repository.owner, repository.repo);
  if (!branches.includes(input.baseBranch)) return { ok: false, reason: "no-branch" };
  return enableProject(deps.db, viewer.email, { owner: repository.owner, repo: repository.repo, baseBranch: input.baseBranch });
}

export type SyncResult = { ok: true; summary: { added: number; updated: number; closed: number } } | { ok: false; error: string };

/**
 * Sync (TIC-5): upsert every open issue, read the state of every known Ticket
 * that did not come back open, and refresh every recorded pull request.
 * GitHub's errors are kept on the Project, not swallowed.
 */
export async function syncProject(deps: AppDeps, viewer: Viewer, projectId: string): Promise<SyncResult | "not-found"> {
  const project = await getProject(deps.db, projectId);
  if (!project) return "not-found";
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

    for (const run of await runsWithPullRequests(deps.db, project.id)) {
      const pr = await deps.github.findPullRequest(project.owner, project.repo, run.branch);
      if (pr) await setPullRequestState(deps.db, run.id, pr.state, now);
    }

    const summary = { added, updated, closed };
    await recordSync(deps.db, project.id, { summary }, now);
    await recordAudit(deps.db, { actorEmail: viewer.email, action: "project.sync", subjectType: "project", subjectId: project.id, detail: summary });
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
