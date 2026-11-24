import { isActive, ticketKeys, ticketStatus, type PullRequestState, type TicketStatus } from "@clauderon/core";
import { listProjects, listTicketsWithRuns } from "@clauderon/db";
import type { AppDeps } from "./deps";

export type TicketFilters = {
  projectId?: string;
  q?: string;
  status?: TicketStatus | string;
  /** Open: every Ticket whose issue is open, any Status; Closed: closed on GitHub. */
  view?: TicketView;
};

export type TicketRow = {
  id: string;
  projectId: string;
  number: number;
  key: string;
  title: string;
  labels: string[];
  url: string;
  authorAssociation: string | null;
  status: TicketStatus;
  /** The Active Run that keeps this Ticket from being selected (TIC-7). */
  activeRunId: string | null;
  activeRunState: string | null;
  /** The newest Real Run, for the table's "Latest Run" column. */
  latestRun: { id: string; state: string; pullRequestState: string | null } | null;
};

const asPrState = (state: string | null): PullRequestState | null => (state === "open" || state === "merged" || state === "closed" ? state : null);

/** The Tickets page's two views: Open (the issue is open on GitHub, whatever its Runs) or Closed. */
export type TicketView = "Open" | "Closed";

/** The view a URL picks; Open unless it asks for Closed. */
export function ticketViewParam(status: string | undefined): TicketView {
  return status === "Closed" ? "Closed" : "Open";
}

/**
 * The Tickets page (TIC-1, TIC-2, TIC-3, TIC-6): key, title, labels and the
 * derived Ticket Status; search by title or key, filter by Project and status.
 */
export async function viewTickets(deps: AppDeps, filters: TicketFilters) {
  const [projects, tickets] = await Promise.all([listProjects(deps.db), listTicketsWithRuns(deps.db)]);
  const keyOf = ticketKeys(projects);
  const q = filters.q?.trim().toLowerCase() ?? "";

  const rows: TicketRow[] = tickets.map((t) => {
    const runs = t.runs.map((r) => ({ ...r, pullRequestState: asPrState(r.pullRequestState) }));
    const real = [...runs].sort((a, b) => b.queuedAt.getTime() - a.queuedAt.getTime());
    const active = real.find((r) => isActive(r.state));
    const latest = real[0];
    return {
      id: t.id,
      projectId: t.projectId,
      number: t.number,
      key: keyOf(t.projectId, t.number),
      title: t.title,
      labels: Array.isArray(t.labels) ? (t.labels as string[]) : [],
      url: t.url,
      authorAssociation: t.authorAssociation,
      status: ticketStatus({ issueState: t.issueState === "closed" ? "closed" : "open" }, runs),
      activeRunId: active?.id ?? null,
      activeRunState: active?.state ?? null,
      latestRun: latest ? { id: latest.id, state: latest.state, pullRequestState: latest.pullRequestState } : null,
    };
  });

  // One read serves the whole page: `all` has every Ticket (for the per-Project counts), the rest is filtered.
  const inProject = filters.projectId ? rows.filter((r) => r.projectId === filters.projectId) : rows;
  // Counts for the status chips: every Ticket the search matches, any status.
  const matching = inProject.filter((r) => !q || r.title.toLowerCase().includes(q) || r.key.toLowerCase().includes(q));
  const counts: Record<string, number> = {};
  for (const r of matching) counts[r.status] = (counts[r.status] ?? 0) + 1;

  const inView = (r: TicketRow) => !filters.view || (filters.view === "Closed") === (r.status === "Closed");
  const views: Record<TicketView, number> = { Open: matching.filter((r) => r.status !== "Closed").length, Closed: counts.Closed ?? 0 };
  return { projects, all: rows, counts, views, total: matching.length, rows: matching.filter((r) => inView(r) && (!filters.status || r.status === filters.status)) };
}
