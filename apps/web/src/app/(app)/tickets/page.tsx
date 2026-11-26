import Link from "next/link";
import { getMachineOfMember } from "@clauderon/db";
import { deps, requireMember } from "../../../server/runtime";
import { ticketViewParam, viewTickets, type TicketView } from "../../../server/tickets";
import { Icon } from "../../../components/icons";
import { ago } from "../../../components/format";
import { tagColor } from "../../../components/state-pill";
import { FilterLink, FilterResults, TicketFilters, TicketSearch } from "./ticket-filters";
import { TicketTable } from "./ticket-table";
import { TicketsSync } from "./tickets-sync";

export const dynamic = "force-dynamic";

const VIEWS: TicketView[] = ["Open", "Closed"];

type Search = { project?: string; q?: string; status?: string };

export default async function TicketsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const member = await requireMember();
  const search = await searchParams;
  // Open Tickets by default: every issue still open on GitHub, whatever its Runs.
  const view = ticketViewParam(search.status);
  // Render from the database; TicketsSync pulls GitHub afterwards (at most once a minute per Project).
  const [{ projects, all, views, rows }, machine] = await Promise.all([
    viewTickets(deps(), { projectId: search.project, q: search.q, view }),
    getMachineOfMember(deps().db, member.id),
  ]);
  const href = (change: Search) => {
    const next = { ...search, ...change };
    // Open is the default, so its link carries no status.
    if (next.status === "Open") next.status = undefined;
    const query = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]);
    return `/tickets${query.size ? `?${query}` : ""}`;
  };
  const perProject = (id: string) => all.filter((r) => r.projectId === id).length;
  const failed = projects.filter((p) => p.syncError);

  // The newest successful sync of any Project, for the "Synced … ago" line.
  const lastSynced = projects.reduce<Date | null>((d, p) => (p.lastSyncedAt && (!d || p.lastSyncedAt > d) ? p.lastSyncedAt : d), null);

  return (
    <>
      <TicketsSync />
      <div className="page-head">
        <div>
          <h1>Tickets</h1>
          <p className="sub">GitHub issues from your Projects. Select the ones to work on and start Runs on your Machine.</p>
        </div>
        {projects.length > 0 && (
          <p className="tk-synced small" title="Tickets sync from GitHub in the background, at most once a minute.">
            {Icon.sync}
            {lastSynced ? `Synced from GitHub ${ago(lastSynced)}` : "Not synced from GitHub yet"}
          </p>
        )}
      </div>

      {!(machine?.tokenHash && machine.claudeLoggedIn && machine.ghLoggedIn) && (
        <div className="banner wait">
          <div className="grow small">
            <b>{machine?.tokenHash ? "Log in to Claude Code and gh on your Machine" : "Pair your computer"} to start Runs.</b> Runs always run on your own
            Machine, with your own accounts.
          </div>
          <Link className="btn sm primary" href={machine?.tokenHash ? `/machines/${machine.id}` : "/machines"}>
            {machine?.tokenHash ? "Open my Machine" : "Pair my computer"}
          </Link>
        </div>
      )}

      {failed.length > 0 && (
        <div className="banner wait">
          <div className="grow small">
            <b>Could not read {failed.map((p) => p.repo).join(", ")} from GitHub.</b> Showing the last synced issues. {failed[0]!.syncError}
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="card empty">
          <b>No Project yet</b>
          Enable a repository on the <Link href="/projects">Projects</Link> page; its open issues show up here.
        </div>
      ) : (
        <TicketFilters>
          <section className="tk-board" aria-label="Tickets">
            <div className="tk-toolbar">
              <nav className="tk-tabs" aria-label="Project">
                <FilterLink href={href({ project: undefined })} className={!search.project ? "on" : ""} current={!search.project}>
                  All projects <span className="n">{all.length}</span>
                </FilterLink>
                {projects.map((p) => (
                  <FilterLink key={p.id} href={href({ project: p.id })} className={search.project === p.id ? "on" : ""} current={search.project === p.id}>
                    <i aria-hidden style={{ background: tagColor(p.repo) }} />
                  {p.repo} <span className="n">{perProject(p.id)}</span>
                  </FilterLink>
                ))}
              </nav>
              <div className="tk-tools">
                <nav className="seg" aria-label="Ticket Status">
                  {VIEWS.map((v) => (
                    <FilterLink key={v} className={view === v ? "on" : ""} href={href({ status: v })} current={view === v}>
                      {v} <span className="n">{views[v]}</span>
                    </FilterLink>
                  ))}
                </nav>
                <TicketSearch project={search.project} status={view === "Closed" ? view : undefined} q={search.q} />
              </div>
            </div>

            <FilterResults>
              <TicketTable rows={rows} searched={!!search.q} view={view} />
            </FilterResults>
          </section>
        </TicketFilters>
      )}
    </>
  );
}
