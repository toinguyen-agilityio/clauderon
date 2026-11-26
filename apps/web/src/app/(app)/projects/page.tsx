import Link from "next/link";
import { ago } from "../../../components/format";
import { Icon } from "../../../components/icons";
import { tagColor } from "../../../components/state-pill";
import { NotificationsToggle } from "../../../components/notifications-live";
import { viewGitHubAccess, type GitHubAccessView } from "../../../server/github-access";
import { canManageProjects, viewProjects } from "../../../server/projects";
import { deps, requireMember } from "../../../server/runtime";
import { EnableForm, GitHubTokenForm, RemoveProjectForm, RemoveTokenForm } from "./forms";

export const dynamic = "force-dynamic";

/** The app's GitHub token: who it reads as; an Operator sets, replaces or removes it (ADR 0010). */
function GitHubAccess({ access, canManage, now }: { access: GitHubAccessView; canManage: boolean; now: Date }) {
  return (
    <section className={`card gh-access ${access ? "is-ok" : "is-missing"}`} aria-labelledby="gh-access-h">
      <div className="gh-access-band">
        <span className="gh-access-dot" aria-hidden />
        <b>{access ? `Reads GitHub as @${access.login}` : "No GitHub token"}</b>
      </div>
      <div className="gh-access-body">
        <h2 id="gh-access-h">GitHub access</h2>
        <p className="small muted">
          One read-only token for every Project. The app only reads issues, branches and pull requests; Runs push with their Starter&apos;s own gh login.
        </p>
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
              Fine-grained, read-only on Contents, Issues and Pull requests. Stored encrypted and never shown again.
            </p>
          </>
        ) : (
          !access && <p className="small muted">Ask an Operator to add one before Projects can be enabled or read.</p>
        )}
      </div>
    </section>
  );
}

export default async function ProjectsPage() {
  const viewer = await requireMember();
  const [projects, access] = await Promise.all([viewProjects(deps()), viewGitHubAccess(deps())]);
  const canManage = canManageProjects(deps(), viewer);
  const now = new Date();
  // Projects come sorted by owner, then repository; each owner gets a header.
  const owners = new Map<string, typeof projects>();
  for (const p of projects) owners.set(p.owner, [...(owners.get(p.owner) ?? []), p]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p className="sub">Each Project is one GitHub repository and its base branch. Its open issues show up as Tickets.</p>
        </div>
      </div>

      <div className="proj-layout">
        <section className="card proj-list" aria-label="Projects">
          {projects.length === 0 && (
            <div className="empty">
              <b>No Project yet</b>
              {!canManage
                ? "An Operator enables repositories as Projects."
                : access
                  ? "Enable a repository below; its open issues show up as Tickets."
                  : "Save a GitHub token first, then enable a repository."}
            </div>
          )}

          {[...owners].map(([owner, owned]) => (
            <div key={owner} className="proj-group">
              <header className="proj-owner">
                <span className="avatar">{owner.slice(0, 1)}</span>
                <span className="proj-owner-name">{owner}</span>
                <span className="faint small">
                  {owned.length} {owned.length === 1 ? "repository" : "repositories"}
                </span>
              </header>
              <ul className="proj-rows">
                {owned.map((p) => (
                  <li key={p.id} className="proj" style={{ "--c": tagColor(p.repo) } as React.CSSProperties}>
                    <span className="proj-mark" aria-hidden>
                      {p.repo.slice(0, 1)}
                    </span>
                    <div className="proj-id">
                      <a className="proj-name" href={`https://github.com/${p.owner}/${p.repo}`} target="_blank" rel="noreferrer" title={`Open ${p.owner}/${p.repo} on GitHub`}>
                        {p.repo}
                        {Icon.external}
                      </a>
                      <div className="proj-meta small">
                        <span className="tk-branch">{p.baseBranch}</span>
                        {p.syncError ? (
                          <span className="proj-sync fail" title={p.syncError}>
                            Could not read from GitHub
                          </span>
                        ) : (
                          <span className="proj-sync">{p.lastSyncedAt ? `Synced ${ago(p.lastSyncedAt, now)}` : "Not synced yet"}</span>
                        )}
                      </div>
                    </div>

                    <div className="proj-counts">
                      <Link className="proj-count" href={`/tickets?project=${p.id}`}>
                        <b>{p.openTickets}</b>
                        <span>open {p.openTickets === 1 ? "Ticket" : "Tickets"}</span>
                      </Link>
                      <span className={`proj-count${p.activeRuns ? " live" : ""}`}>
                        <b>{p.activeRuns}</b>
                        <span>active {p.activeRuns === 1 ? "Run" : "Runs"}</span>
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
            </div>
          ))}

          {canManage && access && <EnableForm />}
        </section>

        <aside className="proj-aside">
          <GitHubAccess access={access} canManage={canManage} now={now} />
          <NotificationsToggle />
        </aside>
      </div>
    </>
  );
}
