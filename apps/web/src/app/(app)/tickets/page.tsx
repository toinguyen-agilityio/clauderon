import Link from "next/link";
import { getMachineOfMember } from "@clauderon/db";
import { Icon } from "../../../components/icons";
import { syncAllProjects } from "../../../server/projects";
import { deps, requireMember } from "../../../server/runtime";
import { viewTickets } from "../../../server/tickets";
import { TicketTable } from "./ticket-table";

export const dynamic = "force-dynamic";

const STATUSES = ["Open", "Queued", "In run", "Needs you", "Failed", "Interrupted", "PR open", "PR merged", "Closed"];

type Search = { project?: string; q?: string; status?: string };

export default async function TicketsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const member = await requireMember();
  const search = await searchParams;
  // GitHub stays the source of truth: pull every Project's issues before reading them.
  await syncAllProjects(deps());
  const [{ projects, counts, total, rows }, machine, all] = await Promise.all([
    viewTickets(deps(), { projectId: search.project, q: search.q, status: search.status }),
    getMachineOfMember(deps().db, member.id),
    viewTickets(deps(), {}),
  ]);
  const href = (change: Search) => {
    const next = { ...search, ...change };
    const query = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]);
    return `/tickets${query.size ? `?${query}` : ""}`;
  };
  const perProject = (id: string) => all.rows.filter((r) => r.projectId === id).length;
  const failed = projects.filter((p) => p.syncError);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Tickets</h1>
          <p className="sub">Open GitHub issues of every Project, read from GitHub each time this page opens. Status comes from their Runs and pull requests.</p>
        </div>
        <Link className="btn" href="/projects">
          {Icon.sync}
          Sync on Projects
        </Link>
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
          Enable a repository on the <Link href="/projects">Projects</Link> page, then Sync to pull its issues.
        </div>
      ) : (
        <>
          <div className="row between">
            <nav className="seg" aria-label="Project">
              <Link href={href({ project: undefined })} className={!search.project ? "on" : ""}>
                All <span className="faint num">{all.rows.length}</span>
              </Link>
              {projects.map((p) => (
                <Link key={p.id} href={href({ project: p.id })} className={search.project === p.id ? "on" : ""}>
                  {p.repo} <span className="faint num">{perProject(p.id)}</span>
                </Link>
              ))}
            </nav>
            <form method="get" role="search" style={{ width: "min(320px, 100%)" }}>
              {search.project && <input type="hidden" name="project" value={search.project} />}
              {search.status && <input type="hidden" name="status" value={search.status} />}
              <input className="input" name="q" defaultValue={search.q ?? ""} placeholder="Search title or key…" aria-label="Search Tickets" />
            </form>
          </div>

          <nav className="chips" aria-label="Ticket Status">
            <Link className={`fchip ${!search.status ? "on" : ""}`} href={href({ status: undefined })}>
              All <span className="n">{total}</span>
            </Link>
            {STATUSES.map((s) => (
              <Link key={s} className={`fchip ${search.status === s ? "on" : ""}`} href={href({ status: s })}>
                {s} <span className="n">{counts[s] ?? 0}</span>
              </Link>
            ))}
          </nav>

          <TicketTable rows={rows} />
        </>
      )}
    </>
  );
}
