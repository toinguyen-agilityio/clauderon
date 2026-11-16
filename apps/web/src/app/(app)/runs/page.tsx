import Link from "next/link";
import { RUN_STATES } from "@clauderon/core";
import { formatTime } from "../../../components/format";
import { StatePill } from "../../../components/state-pill";
import { parseRunFilters, viewRuns } from "../../../server/runs";
import { deps, requireMember } from "../../../server/runtime";

export const dynamic = "force-dynamic";

type Search = { state?: string; flow?: string; pod?: string; page?: string };

export default async function RunsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireMember();
  const search = await searchParams;
  const page = Math.max(1, Number(search.page) || 1);
  const filters = parseRunFilters(search);
  const { rows, hasMore, total, flows, pods } = await viewRuns(deps(), filters, page);
  const link = (p: number) => `/runs?${new URLSearchParams({ ...(search.state && { state: search.state }), ...(search.flow && { flow: search.flow }), ...(search.pod && { pod: search.pod }), page: String(p) })}`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Runs</h1>
          <p className="sub">Every Run, newest first. A Run takes one Ticket through one Flow on its Starter&apos;s Pod.</p>
        </div>
      </div>
      <div className="card">
        <form className="filters" method="get">
          <select className="input" name="state" defaultValue={filters.state ?? ""} aria-label="State">
            <option value="">Any state</option>
            {RUN_STATES.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <select className="input" name="flow" defaultValue={filters.flowId ?? ""} aria-label="Flow">
            <option value="">Any Flow</option>
            {flows.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <select className="input" name="pod" defaultValue={filters.podId ?? ""} aria-label="Pod">
            <option value="">Any Pod</option>
            {pods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.owner}
              </option>
            ))}
          </select>
          <button className="btn" type="submit">
            Filter
          </button>
          <span className="faint small">{total} in all</span>
        </form>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Flow</th>
                <th>Mode</th>
                <th>State</th>
                <th>Starter</th>
                <th>Pod</th>
                <th>Queued</th>
                <th>Started</th>
                <th>Ended</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="faint">
                    No Runs match.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/runs/${r.id}`}>
                      <span className="mono">{r.key}</span> {r.ticketTitle}
                    </Link>
                  </td>
                  <td>{r.flowName}</td>
                  <td>
                    <span className="tag">{r.mode}</span>
                  </td>
                  <td>
                    <StatePill state={r.state} />
                  </td>
                  <td>{r.starterName ?? r.starterEmail}</td>
                  <td>{r.podOwner}</td>
                  <td className="faint small num">{formatTime(r.queuedAt)}</td>
                  <td className="faint small num">{formatTime(r.startedAt)}</td>
                  <td className="faint small num">{formatTime(r.endedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pager">
          {page > 1 && (
            <Link className="btn sm" href={link(page - 1)}>
              Newer
            </Link>
          )}
          <span className="faint small">Page {page}</span>
          {hasMore && (
            <Link className="btn sm" href={link(page + 1)}>
              Older
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
