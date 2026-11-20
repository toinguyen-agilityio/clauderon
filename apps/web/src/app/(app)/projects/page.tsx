import Link from "next/link";
import { ago } from "../../../components/format";
import { Icon } from "../../../components/icons";
import { canManageProjects, viewProjects } from "../../../server/projects";
import { deps, requireMember } from "../../../server/runtime";
import { EnableForm, RemoveProjectForm, SyncForm } from "./forms";

export const dynamic = "force-dynamic";

type ProjectRow = Awaited<ReturnType<typeof viewProjects>>[number];

// Nothing syncs by itself, so a day-old Sync is worth a nudge.
const STALE_MS = 24 * 3_600_000;

function SyncStatus({ p, now }: { p: ProjectRow; now: Date }) {
  if (p.syncError) return <span className="pill fail">Sync failed</span>;
  if (!p.lastSyncedAt) return <span className="pill">Never synced</span>;
  const stale = now.getTime() - p.lastSyncedAt.getTime() > STALE_MS;
  const s = p.syncSummary;
  return (
    <>
      <span className={`pill ${stale ? "wait" : "ok"}`}>Synced {ago(p.lastSyncedAt, now)}</span>
      {s && (
        <span className="faint small">
          {s.added} added, {s.updated} updated, {s.closed} closed
        </span>
      )}
    </>
  );
}

export default async function ProjectsPage() {
  const viewer = await requireMember();
  const projects = await viewProjects(deps());
  const canManage = canManageProjects(deps(), viewer);
  const now = new Date();
  // Every Project shares one owner (PRJ-2), so it is named once.
  const owner = projects[0]?.owner;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p className="sub">Each Project is one GitHub repository and its base branch. Sync pulls its open issues in as Tickets.</p>
        </div>
      </div>

      <section className="card proj-list" aria-label="Projects">
        {owner && (
          <header className="proj-owner">
            <span className="avatar">{owner.slice(0, 1)}</span>
            <span className="mono">{owner}</span>
            <span className="faint small">
              {projects.length} {projects.length === 1 ? "repository" : "repositories"}
            </span>
          </header>
        )}

        {projects.length === 0 && (
          <div className="empty">
            <b>No Project yet</b>
            {canManage ? "Enable a repository below, then Sync to pull its issues in as Tickets." : "An Operator enables repositories as Projects."}
          </div>
        )}

        <ul className="proj-rows">
          {projects.map((p) => (
            <li key={p.id} className={`proj${p.syncError ? " has-err" : ""}`}>
              <div className="proj-id">
                <a className="proj-name" href={`https://github.com/${p.owner}/${p.repo}`} target="_blank" rel="noreferrer" title={`Open ${p.owner}/${p.repo} on GitHub`}>
                  {p.repo}
                  {Icon.external}
                </a>
                <span className="otype" style={{ "--c": "var(--t-branch)" } as React.CSSProperties}>
                  <i />
                  {p.baseBranch}
                </span>
              </div>

              <div className="proj-counts">
                <Link className="proj-count" href={`/tickets?project=${p.id}`}>
                  <b>{p.openTickets}</b>
                  <span>Open {p.openTickets === 1 ? "Ticket" : "Tickets"}</span>
                </Link>
                <span className={`proj-count${p.activeRuns ? " live" : ""}`}>
                  <b>{p.activeRuns}</b>
                  <span>Active {p.activeRuns === 1 ? "Run" : "Runs"}</span>
                </span>
              </div>

              <div className="proj-sync">
                <SyncStatus p={p} now={now} />
              </div>

              <div className="proj-actions">
                <SyncForm projectId={p.id} />
                {canManage && <RemoveProjectForm projectId={p.id} name={`${p.owner}/${p.repo}`} />}
              </div>

              {p.syncError && (
                <p className="proj-err" role="status">
                  {p.syncError}
                  {p.lastSyncedAt && <span className="faint"> Last good Sync {ago(p.lastSyncedAt, now)}.</span>}
                </p>
              )}
            </li>
          ))}
        </ul>

        {canManage && <EnableForm />}
      </section>

      <aside className="proj-notes">
        <div className="stack">
          <h2>GitHub access for the app</h2>
          <p className="small muted">
            The app reads issues, branches and pull requests with one read-only token from its configuration. It never writes to GitHub:
            Runs push branches and open pull requests with their Starter&apos;s own gh login, on their Machine.
          </p>
        </div>
        <div className="stack">
          <h2>How Sync works</h2>
          <ul className="small muted">
            <li>Sync pulls the repository&apos;s open issues into Tickets; issues closed on GitHub show as Closed.</li>
            <li>Pull request state is read on Sync to derive each Ticket&apos;s status.</li>
            <li>Sync never starts a Run, and nothing syncs by itself.</li>
          </ul>
        </div>
      </aside>
    </>
  );
}
