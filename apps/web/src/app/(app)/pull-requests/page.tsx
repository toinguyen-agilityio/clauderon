import Link from "next/link";
import { Avatar } from "../../../components/brand";
import { ago } from "../../../components/format";
import { Icon } from "../../../components/icons";
import { Tabs } from "../../../components/tabs";
import { parsePullRequestTab, viewPullRequests } from "../../../server/runs";
import { deps, requireMember } from "../../../server/runtime";

export const dynamic = "force-dynamic";

type Search = { project?: string; tab?: string; page?: string };

export default async function PullRequestsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const member = await requireMember();
  const search = await searchParams;
  const tab = parsePullRequestTab(search.tab);
  const page = Math.max(1, Number(search.page) || 1);
  const view = await viewPullRequests(deps(), member, { tab, projectId: search.project || undefined, page });
  const { rows, hasMore, counts, projects } = view;
  const now = new Date();
  // A new filter starts again at page 1.
  const href = (change: Omit<Search, "page">, p?: number) => {
    const next = { project: search.project, tab: search.tab, ...change, page: p && p > 1 ? String(p) : undefined };
    const query = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]);
    return `/pull-requests${query.size ? `?${query}` : ""}`;
  };
  const empty =
    tab !== "needs-you"
      ? "No pull request is open on any Project."
      : view.ghAccount
        ? `No open pull request is waiting on a review from @${view.ghAccount}.`
        : "Log in to gh on your Machine so this page knows your GitHub account.";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pull requests</h1>
          <p className="sub">
            Open pull requests of every Project, read from GitHub each time this page opens. Needs you: you are asked to review them.
          </p>
        </div>
      </div>

      {view.errors.length > 0 && (
        <div className="banner wait">
          <div className="grow small">
            <b>Could not read {view.errors.map((e) => e.repo).join(", ")} from GitHub.</b> Only pull requests Runs opened are shown for it.{" "}
            {view.errors[0]!.error}
          </div>
        </div>
      )}

      {projects.length > 0 && (
        <div className="row">
          <nav className="seg" aria-label="Project">
            <Link href={href({ project: undefined })} className={!search.project ? "on" : ""}>
              All <span className="faint num">{view.total}</span>
            </Link>
            {projects.map((p) => (
              <Link key={p.id} href={href({ project: p.id })} className={search.project === p.id ? "on" : ""}>
                {p.repo} <span className="faint num">{view.perProject[p.id] ?? 0}</span>
              </Link>
            ))}
          </nav>
        </div>
      )}

      <Tabs
        label="Pull requests"
        tabs={[
          { href: href({ tab: undefined }), label: "Open", count: counts.open, active: !tab },
          { href: href({ tab: "needs-you" }), label: "Needs you", count: counts.needsYou, active: tab === "needs-you" },
        ]}
      />

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Pull request</th>
                <th>Ticket</th>
                <th>Flow</th>
                <th>Opened by</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <div className="empty">
                      <b>No pull requests</b>
                      {empty}
                    </div>
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="t-title">
                    <span className="mono faint small">
                      {r.repo}{" "}
                      {r.url ? (
                        <a className="mono" href={r.url} target="_blank" rel="noreferrer">
                          #{r.number} {Icon.external}
                        </a>
                      ) : (
                        <span className="mono">#{r.number}</span>
                      )}
                    </span>
                    {r.title && <div>{r.title}</div>}
                    {r.needsYou && <span className="pill wait">Needs you</span>}
                    {r.branch && <div className="mono faint small clip pr-branch">{r.branch}</div>}
                  </td>
                  <td className="t-title">
                    {r.run ? (
                      <>
                        <span className="mono faint small">{r.run.key}</span>
                        <div>
                          <Link href={`/runs/${r.run.id}`}>{r.run.ticketTitle}</Link>
                        </div>
                      </>
                    ) : (
                      <span className="faint small">Not opened by a Run</span>
                    )}
                  </td>
                  <td className="small nowrap">{r.run?.flowName ?? <span className="faint">—</span>}</td>
                  <td>
                    {r.run ? (
                      <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                        <Avatar name={r.run.starterName} email={r.run.starterEmail} picture={r.run.starterPicture} />
                        <span className="small nowrap">
                          {r.run.starterName ?? r.run.starterEmail}
                          <div className="faint">{ago(r.at, now)}</div>
                        </span>
                      </div>
                    ) : (
                      <span className="small nowrap">
                        <span className="mono">@{r.authorLogin}</span>
                        <div className="faint">{ago(r.at, now)}</div>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(page > 1 || hasMore) && (
          <div className="pager">
            {page > 1 && (
              <Link className="btn sm" href={href({}, page - 1)}>
                Newer
              </Link>
            )}
            <span className="faint small">Page {page}</span>
            {hasMore && (
              <Link className="btn sm" href={href({}, page + 1)}>
                Older
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}
