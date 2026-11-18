import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "../../../components/brand";
import { ago, duration } from "../../../components/format";
import { StatePill } from "../../../components/state-pill";
import { parseRunFilters, viewRuns } from "../../../server/runs";
import { deps, requireMember } from "../../../server/runtime";
import { FilterSelect } from "./filters";

export const dynamic = "force-dynamic";

type Search = { state?: string; flow?: string; pod?: string; page?: string };

const SUMMARY = ["running", "queued", "failed", "succeeded"] as const;
const STATE_OPTIONS = [
  ["queued", "Queued"],
  ["running", "Running"],
  ["waiting_for_human", "Waiting for you"],
  ["succeeded", "Succeeded"],
  ["failed", "Failed"],
  ["interrupted", "Interrupted"],
  ["cancelled", "Cancelled"],
].map(([value, label]) => ({ value: value!, label: label! }));

export default async function RunsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireMember();
  const search = await searchParams;
  const page = Math.max(1, Number(search.page) || 1);
  const filters = parseRunFilters(search);
  const { rows, hasMore, total, counts, flows, pods } = await viewRuns(deps(), filters, page);
  const now = new Date();
  const href = (change: Search) => {
    const query = new URLSearchParams(Object.entries({ ...search, ...change }).filter(([, v]) => v) as [string, string][]);
    return `/runs${query.size ? `?${query}` : ""}`;
  };
  const filtered = Boolean(filters.state || filters.flowId || filters.podId);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Runs</h1>
          <p className="sub">Every Run, newest first. A Run takes one Ticket through one Flow on its Starter&apos;s Pod.</p>
        </div>
      </div>

      <div className="stats">
        {SUMMARY.map((s) => (
          <Link key={s} className={`card stat ${filters.state === s ? "on" : ""}`} href={href({ state: filters.state === s ? undefined : s, page: undefined })}>
            <StatePill state={s} />
            <span className="big num">{counts[s] ?? 0}</span>
          </Link>
        ))}
      </div>

      <div className="row">
        <Suspense>
          <FilterSelect name="state" label="All states" options={STATE_OPTIONS} />
          <FilterSelect name="flow" label="All Flows" options={flows.map((f) => ({ value: f.id, label: f.name }))} />
          <FilterSelect name="pod" label="All Pods" options={pods.map((p) => ({ value: p.id, label: p.label }))} />
        </Suspense>
        {filtered && (
          <Link className="btn ghost sm" href="/runs">
            Clear filters
          </Link>
        )}
        <span className="faint small" style={{ marginLeft: "auto" }}>
          {total} Run{total === 1 ? "" : "s"}
        </span>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Flow</th>
                <th>State</th>
                <th>Pod</th>
                <th>Started by</th>
                <th>Duration</th>
                <th>PR</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty">
                      <b>{filtered ? "No Runs match these filters" : "No Runs yet"}</b>
                      {filtered ? "Clear the filters to see every Run." : "Select Tickets and press Start to send them through a Flow."}
                    </div>
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="t-title">
                    <span className="mono faint small">{r.key}</span>
                    {r.mode === "dry" && (
                      <>
                        {" "}
                        <span className="tag dry">Dry-run</span>
                      </>
                    )}
                    <div>
                      <Link href={`/runs/${r.id}`}>{r.ticketTitle}</Link>
                    </div>
                  </td>
                  <td className="small nowrap">{r.flowName}</td>
                  <td>
                    <StatePill state={r.state} />
                  </td>
                  <td className="small nowrap">{r.pod}</td>
                  <td>
                    <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                      <Avatar name={r.starterName} email={r.starterEmail} picture={r.starterPicture} />
                      <span className="small nowrap">
                        {r.starterName ?? r.starterEmail}
                        <div className="faint">{ago(r.queuedAt, now)}</div>
                      </span>
                    </div>
                  </td>
                  <td className="num small nowrap">{r.startedAt ? duration((r.endedAt ?? now).getTime() - r.startedAt.getTime()) : <span className="faint">—</span>}</td>
                  <td className="mono small nowrap">
                    {r.pullRequestNumber ? (
                      <>
                        #{r.pullRequestNumber} <span className="faint">{r.pullRequestState}</span>
                      </>
                    ) : (
                      <span className="faint">—</span>
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
              <Link className="btn sm" href={href({ page: String(page - 1) })}>
                Newer
              </Link>
            )}
            <span className="faint small">Page {page}</span>
            {hasMore && (
              <Link className="btn sm" href={href({ page: String(page + 1) })}>
                Older
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}
