import Link from "next/link";
import { ago } from "../../../components/format";
import { Tabs } from "../../../components/tabs";
import { parsePullRequestTab, viewPullRequests } from "../../../server/runs";
import { deps, requireMember } from "../../../server/runtime";
import { PullRequestTable } from "./pull-request-table";

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
            Open pull requests of every Project, read from GitHub at most every 30 seconds. Needs you: you are asked to review them. Select some to start Runs with a Flow whose Input is a pull request.
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
        <PullRequestTable rows={rows.map(({ at, ...r }) => ({ ...r, ago: ago(at, now) }))} empty={empty} />
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
