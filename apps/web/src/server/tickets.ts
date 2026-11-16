import { isActive, ticketKeys, ticketStatus, type PullRequestState, type TicketStatus } from "@clauderon/core";
import { listProjects, listTicketsWithRuns } from "@clauderon/db";
import type { AppDeps } from "./deps";

export type TicketFilters = { projectId?: string; q?: string; status?: TicketStatus | string };

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
};

const asPrState = (state: string | null): PullRequestState | null => (state === "open" || state === "merged" || state === "closed" ? state : null);

/**
 * The Tickets page (TIC-1, TIC-2, TIC-3, TIC-6): key, title, labels and the
 * derived Ticket Status; search by title or key, filter by Project and status.
 */
export async function viewTickets(deps: AppDeps, filters: TicketFilters) {
  const [projects, tickets] = await Promise.all([listProjects(deps.db), listTicketsWithRuns(deps.db, filters.projectId || undefined)]);
  const keyOf = ticketKeys(projects);
  const q = filters.q?.trim().toLowerCase() ?? "";

  const rows: TicketRow[] = tickets.map((t) => {
    const runs = t.runs.map((r) => ({ ...r, pullRequestState: asPrState(r.pullRequestState) }));
    const active = runs.filter((r) => r.mode === "real" && isActive(r.state)).sort((a, b) => b.queuedAt.getTime() - a.queuedAt.getTime())[0];
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
    };
  });

  return {
    projects,
    rows: rows.filter(
      (r) => (!q || r.title.toLowerCase().includes(q) || r.key.toLowerCase().includes(q)) && (!filters.status || r.status === filters.status),
    ),
  };
}
