import Link from "next/link";
import { Avatar } from "../../../components/brand";
import { ago } from "../../../components/format";
import { Icon } from "../../../components/icons";
import { Tabs } from "../../../components/tabs";
import { PULL_REQUEST_TABS, parsePullRequestTab, viewPullRequests } from "../../../server/runs";
import { deps, requireMember } from "../../../server/runtime";

export const dynamic = "force-dynamic";

type Search = { state?: string; page?: string };

const TAB_LABEL = { open: "Open", merged: "Merged", closed: "Closed" } as const;
const EMPTY = {
  all: "No Run has opened a pull request yet.",
  open: "No pull request is open for review.",
  merged: "No pull request has been merged yet.",
  closed: "No pull request was closed without merging.",
} as const;

export default async function PullRequestsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireMember();
  const search = await searchParams;
  const state = parsePullRequestTab(search.state);
  const page = Math.max(1, Number(search.page) || 1);
  const { rows, hasMore, counts } = await viewPullRequests(deps(), state, page);
  const now = new Date();
  const total = PULL_REQUEST_TABS.reduce((n, s) => n + (counts[s] ?? 0), 0);
  const href = (s: string | undefined, p?: number) => {
    const query = new URLSearchParams();
    if (s) query.set("state", s);
    if (p && p > 1) query.set("page", String(p));
    return `/pull-requests${query.size ? `?${query}` : ""}`;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pull requests</h1>
          <p className="sub">Pull requests opened by Runs, newest first. GitHub stays the source of truth; open ones refresh at most once a minute.</p>
        </div>
      </div>

      <Tabs
        label="Pull request state"
        tabs={[
          { href: href(undefined), label: "All", count: total, active: !state },
          ...PULL_REQUEST_TABS.map((s) => ({ href: href(s), label: TAB_LABEL[s], count: counts[s] ?? 0, active: state === s })),
        ]}
      />

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Pull request</th>
                <th>Ticket</th>
                <th>State</th>
                <th>Flow</th>
                <th>Started by</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty">
                      <b>No pull requests</b>
                      {EMPTY[state ?? "all"]}
                    </div>
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="nowrap">
                    {r.pullRequestUrl ? (
                      <a className="mono" href={r.pullRequestUrl} target="_blank" rel="noreferrer">
                        #{r.pullRequestNumber} {Icon.external}
                      </a>
                    ) : (
                      <span className="mono">#{r.pullRequestNumber}</span>
                    )}
                    {r.branch && <div className="mono faint small clip pr-branch">{r.branch}</div>}
                  </td>
                  <td className="t-title">
                    <span className="mono faint small">{r.key}</span>
                    <div>
                      <Link href={`/runs/${r.id}`}>{r.ticketTitle}</Link>
                    </div>
                  </td>
                  <td>
                    <span className={`pill ${r.pullRequestState === "open" ? "ok" : r.pullRequestState === "merged" ? "merged" : ""}`}>
                      {r.pullRequestState ?? "unknown"}
                    </span>
                  </td>
                  <td className="small nowrap">{r.flowName}</td>
                  <td>
                    <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                      <Avatar name={r.starterName} email={r.starterEmail} picture={r.starterPicture} />
                      <span className="small nowrap">
                        {r.starterName ?? r.starterEmail}
                        <div className="faint">{ago(r.queuedAt, now)}</div>
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(page > 1 || hasMore) && (
          <div className="pager">
            {page > 1 && (
              <Link className="btn sm" href={href(state, page - 1)}>
                Newer
              </Link>
            )}
            <span className="faint small">Page {page}</span>
            {hasMore && (
              <Link className="btn sm" href={href(state, page + 1)}>
                Older
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}
