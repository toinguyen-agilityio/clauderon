import Link from "next/link";
import { ago } from "../../../components/format";
import { Icon } from "../../../components/icons";
import { viewGitHubAccess, type GitHubAccessView } from "../../../server/github-access";
import { canManageProjects, viewProjects } from "../../../server/projects";
import { deps, requireMember } from "../../../server/runtime";
import { EnableForm, GitHubTokenForm, RemoveProjectForm, RemoveTokenForm } from "./forms";

export const dynamic = "force-dynamic";

/** The app's GitHub token: who it reads as; an Operator sets, replaces or removes it (ADR 0010). */
function GitHubAccess({ access, canManage, now }: { access: GitHubAccessView; canManage: boolean; now: Date }) {
  return (
    <section className="card gh-access" aria-labelledby="gh-access-h">
      <div className="gh-access-head">
        <div className="stack">
          <h2 id="gh-access-h">GitHub access</h2>
          <p className="small muted">
            One read-only token for every Project: the app reads issues, branches and pull requests with it and never writes to GitHub. Runs push and
            open pull requests with their Starter&apos;s own gh login, on their Machine.
          </p>
        </div>
        {access ? (
          <span className="pill ok">Reads as @{access.login}</span>
        ) : (
          <span className="pill wait">No token</span>
        )}
      </div>
      {access && (
        <div className="gh-access-row small">
          <span className="mono">••••{access.last4}</span>
          <span className="faint">
            Set by {access.setByEmail} {ago(access.setAt, now)}
          </span>
          {canManage && <RemoveTokenForm />}
        </div>
      )}
      {canManage ? (
        <>
          <GitHubTokenForm replacing={access !== null} />
          <p className="hint">
            Use a fine-grained token with read-only access to Contents, Issues and Pull requests of the Projects&apos; repositories. It is stored encrypted
            and never shown again.
          </p>
        </>
      ) : (
        !access && <p className="small muted">Ask an Operator to add one before Projects can be enabled or read.</p>
      )}
    </section>
  );
}

export default async function ProjectsPage() {
  const viewer = await requireMember();
  const [projects, access] = await Promise.all([viewProjects(deps()), viewGitHubAccess(deps())]);
  const canManage = canManageProjects(deps(), viewer);
  const now = new Date();
  // Every Project shares one owner (PRJ-2), so it is named once.
  const owner = projects[0]?.owner;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p className="sub">Each Project is one GitHub repository and its base branch. Its open issues show up as Tickets, read from GitHub in the background.</p>
        </div>
      </div>

      <GitHubAccess access={access} canManage={canManage} now={now} />

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
            {!canManage
              ? "An Operator enables repositories as Projects."
              : access
                ? "Enable a repository below; its open issues show up as Tickets."
                : "Save a GitHub token above, then enable a repository."}
          </div>
        )}

        <ul className="proj-rows">
          {projects.map((p) => (
            <li key={p.id} className="proj">
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

              {canManage && (
                <div className="proj-actions">
                  <RemoveProjectForm projectId={p.id} name={`${p.owner}/${p.repo}`} />
                </div>
              )}
            </li>
          ))}
        </ul>

        {canManage && access && <EnableForm />}
      </section>
    </>
  );
}
