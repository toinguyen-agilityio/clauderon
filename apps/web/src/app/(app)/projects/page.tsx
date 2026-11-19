import Link from "next/link";
import { ago } from "../../../components/format";
import { viewProjects } from "../../../server/projects";
import { deps, requireMember } from "../../../server/runtime";
import { EnableForm, SyncForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  await requireMember();
  const projects = await viewProjects(deps());
  const now = new Date();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p className="sub">Each Project is one GitHub repository and its base branch. Its open issues become Tickets when you Sync.</p>
        </div>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Repository</th>
                <th>Base branch</th>
                <th>Open Tickets</th>
                <th>Active Runs</th>
                <th>Last Sync</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="empty">
                      <b>No Project yet</b>
                      Enable a repository the app&apos;s token can read, then Sync to pull its issues.
                    </div>
                  </td>
                </tr>
              )}
              {projects.map((p) => (
                <tr key={p.id}>
                  <td className="mono nowrap">
                    {p.owner}/{p.repo}
                  </td>
                  <td>
                    <span className="otype" style={{ "--c": "var(--t-branch)" } as React.CSSProperties}>
                      <i />
                      {p.baseBranch}
                    </span>
                  </td>
                  <td className="num">{p.openTickets}</td>
                  <td className="num">{p.activeRuns}</td>
                  <td className="small">
                    {p.syncError ? (
                      <span className="err-text" title={p.lastSyncedAt ? `Last good Sync ${ago(p.lastSyncedAt, now)}` : undefined}>
                        {p.syncError}
                      </span>
                    ) : p.lastSyncedAt ? (
                      <span className="faint">
                        {ago(p.lastSyncedAt, now)}
                        {p.syncSummary && ` · ${p.syncSummary.added} added, ${p.syncSummary.updated} updated, ${p.syncSummary.closed} closed`}
                      </span>
                    ) : (
                      <span className="faint">never</span>
                    )}
                  </td>
                  <td className="actions">
                    <div className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                      <SyncForm projectId={p.id} />
                      <Link className="btn ghost sm" href={`/tickets?project=${p.id}`}>
                        Tickets
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <EnableForm />
      </div>

      <div className="grid g2">
        <div className="card card-pad stack">
          <h2>GitHub access for the app</h2>
          <p className="small muted">
            The app reads issues, branches and pull requests with one read-only token from its configuration. It never writes to GitHub:
            Runs push branches and open pull requests with their Starter&apos;s own gh login, on their Machine. All Projects share one owner.
          </p>
        </div>
        <div className="card card-pad stack">
          <h2>How Sync works</h2>
          <ul className="small" style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            <li>Sync pulls the repository&apos;s open issues into Tickets.</li>
            <li>Issues closed on GitHub show as Closed.</li>
            <li>Sync never starts a Run, and nothing syncs by itself.</li>
            <li>Pull request state is read on Sync to derive each Ticket&apos;s status.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
