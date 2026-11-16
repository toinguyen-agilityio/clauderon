import { deps, requireMember } from "../../../server/runtime";
import { viewTickets } from "../../../server/tickets";
import { TicketTable } from "./ticket-table";

export const dynamic = "force-dynamic";

const STATUSES = ["Open", "Queued", "In run", "Needs you", "Failed", "Interrupted", "PR open", "PR merged", "Closed"];

type Search = { project?: string; q?: string; status?: string };

export default async function TicketsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireMember();
  const search = await searchParams;
  const { projects, rows } = await viewTickets(deps(), { projectId: search.project, q: search.q, status: search.status });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Tickets</h1>
          <p className="sub">Open GitHub issues of every Project. Status comes from their Runs and pull requests; GitHub stays the source of truth.</p>
        </div>
      </div>
      <div className="card">
        <form className="filters" method="get">
          <input className="input" name="q" defaultValue={search.q ?? ""} placeholder="Search by title or key" aria-label="Search" style={{ width: 240 }} />
          <select className="input" name="project" defaultValue={search.project ?? ""} aria-label="Project">
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.owner}/{p.repo}
              </option>
            ))}
          </select>
          <select className="input" name="status" defaultValue={search.status ?? ""} aria-label="Status">
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button className="btn" type="submit">
            Filter
          </button>
        </form>
        <TicketTable rows={rows} />
      </div>
    </>
  );
}
