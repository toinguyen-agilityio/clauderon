import { listProjects } from "@clauderon/db";
import { formatTime } from "../../../components/format";
import { deps, requireMember } from "../../../server/runtime";
import { EnableForm, SyncForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  await requireMember();
  const projects = await listProjects(deps().db);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p className="sub">
            GitHub repositories enabled here, each with its base branch. Sync pulls their open issues in as Tickets; it never starts a Run
            and never writes to GitHub.
          </p>
        </div>
      </div>
      <div className="card">
        <div className="card-head">
          <h2>
            Enabled repositories <span className="faint small num">· {projects.length}</span>
          </h2>
          <EnableForm />
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Repository</th>
                <th>Base branch</th>
                <th>Last Sync</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 && (
                <tr>
                  <td colSpan={4} className="faint">
                    No Project yet. Enable a repository the app&apos;s token can read.
                  </td>
                </tr>
              )}
              {projects.map((p) => (
                <tr key={p.id}>
                  <td className="mono">
                    {p.owner}/{p.repo}
                  </td>
                  <td className="mono">{p.baseBranch}</td>
                  <td className="small">
                    {p.syncError ? (
                      <span className="err-text">{p.syncError}</span>
                    ) : p.lastSyncedAt ? (
                      <span className="faint">
                        {formatTime(p.lastSyncedAt)}
                        {p.syncSummary && ` · ${p.syncSummary.added} added, ${p.syncSummary.updated} updated, ${p.syncSummary.closed} closed`}
                      </span>
                    ) : (
                      <span className="faint">never</span>
                    )}
                  </td>
                  <td>
                    <SyncForm projectId={p.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
