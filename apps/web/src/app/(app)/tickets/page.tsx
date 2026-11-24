import Link from "next/link";
import { getMachineOfMember } from "@clauderon/db";
import { deps, requireMember } from "../../../server/runtime";
import { viewTickets } from "../../../server/tickets";
import { FilterLink, FilterResults, TicketFilters, TicketSearch } from "./ticket-filters";
import { TicketTable } from "./ticket-table";
import { TicketsSync } from "./tickets-sync";

export const dynamic = "force-dynamic";

const STATUSES = ["Open", "Queued", "In run", "Needs you", "Failed", "Interrupted", "PR open", "PR merged", "Closed"];

type Search = { project?: string; q?: string; status?: string };

export default async function TicketsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const member = await requireMember();
  const search = await searchParams;
  // Render from the database; TicketsSync pulls GitHub afterwards (at most once a minute per Project).
  const [{ projects, all, counts, total, rows }, machine] = await Promise.all([
    viewTickets(deps(), { projectId: search.project, q: search.q, status: search.status }),
    getMachineOfMember(deps().db, member.id),
  ]);
  const href = (change: Search) => {
    const next = { ...search, ...change };
    const query = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]);
    return `/tickets${query.size ? `?${query}` : ""}`;
  };
  const perProject = (id: string) => all.filter((r) => r.projectId === id).length;
  const failed = projects.filter((p) => p.syncError);

  return (
    <>
      <TicketsSync />
      <div className="page-head">
        <div>
          <h1>Tickets</h1>
          <p className="sub">Open GitHub issues of every Project, synced from GitHub in the background, at most once a minute. Status comes from their Runs and pull requests.</p>
        </div>
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
          <div className="row between">
            <nav className="seg" aria-label="Project">
              <FilterLink href={href({ project: undefined })} className={!search.project ? "on" : ""}>
                All <span className="faint num">{all.length}</span>
              </FilterLink>
              {projects.map((p) => (
                <FilterLink key={p.id} href={href({ project: p.id })} className={search.project === p.id ? "on" : ""}>
                  {p.repo} <span className="faint num">{perProject(p.id)}</span>
                </FilterLink>
              ))}
            </nav>
            <TicketSearch project={search.project} status={search.status} q={search.q} />
          </div>

          <nav className="chips" aria-label="Ticket Status">
            <FilterLink className={`fchip ${!search.status ? "on" : ""}`} href={href({ status: undefined })}>
              All <span className="n">{total}</span>
            </FilterLink>
            {STATUSES.map((s) => (
              <FilterLink key={s} className={`fchip ${search.status === s ? "on" : ""}`} href={href({ status: s })}>
                {s} <span className="n">{counts[s] ?? 0}</span>
              </FilterLink>
            ))}
          </nav>

          <FilterResults>
            <TicketTable rows={rows} />
          </FilterResults>
        </TicketFilters>
      )}
    </>
  );
}
