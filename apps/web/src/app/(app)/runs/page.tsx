import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "../../../components/brand";
import { ago, duration } from "../../../components/format";
import { Pager } from "../../../components/pager";
import { parsePaging } from "../../../components/paging";
import { outputColor, runStateLook, StatePill, tagColor } from "../../../components/state-pill";
import { parseRunFilters, viewRuns } from "../../../server/runs";
import { deps, requireMember } from "../../../server/runtime";
import { FilterSelect } from "./filters";

export const dynamic = "force-dynamic";

type Search = { state?: string; flow?: string; machine?: string; page?: string; size?: string };

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
  const paging = parsePaging(search);
  const filters = parseRunFilters(search);
  const { rows, total, page, counts, flows, machines } = await viewRuns(deps(), filters, paging.page, paging.size);
  const now = new Date();
  const href = (change: Search) => {
    const query = new URLSearchParams(Object.entries({ ...search, ...change }).filter(([, v]) => v) as [string, string][]);
    return `/runs${query.size ? `?${query}` : ""}`;
  };
  const all = Object.values(counts as Record<string, number>).reduce((a, b) => a + b, 0);
  const filtered = Boolean(filters.state || filters.flowId || filters.machineId);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Runs</h1>
          <p className="sub">Every Run, newest first. A Run takes one Ticket through one Flow on its Starter&apos;s Machine.</p>
        </div>
      </div>

      <section className="tk-board" aria-label="Runs">
        <div className="tk-toolbar">
          <nav className="tk-tabs" aria-label="Run state">
            <Link href={href({ state: undefined, page: undefined })} className={!filters.state ? "on" : ""} aria-current={!filters.state || undefined}>
              All <span className="n">{all}</span>
            </Link>
            {SUMMARY.map((s) => {
              const [tone, label] = runStateLook(s);
              const on = filters.state === s;
              return (
                <Link key={s} href={href({ state: on ? undefined : s, page: undefined })} className={`tone-${tone || "mute"} ${s}${on ? " on" : ""}`} aria-current={on || undefined}>
                  <i aria-hidden />
                  {label} <span className="n">{counts[s] ?? 0}</span>
                </Link>
              );
            })}
          </nav>
          <div className="tk-tools">
            <Suspense>
              <FilterSelect name="state" label="All states" options={STATE_OPTIONS} />
              <FilterSelect name="flow" label="All Flows" options={flows.map((f) => ({ value: f.id, label: f.name }))} />
              <FilterSelect name="machine" label="All Machines" options={machines.map((p) => ({ value: p.id, label: p.label }))} />
            </Suspense>
            {filtered && (
              <Link className="btn ghost sm" href="/runs">
                Clear filters
              </Link>
            )}
          </div>
        </div>

        <div className="tbl-wrap">
          <table className="tbl tk-table">
            <caption className="sr-only">
              {total} Run{total === 1 ? "" : "s"}
            </caption>
            <thead>
              <tr>
                <th className="tk-stub">Started from</th>
                <th>Run</th>
                <th>State</th>
                <th>Started by</th>
                <th className="tk-right">Duration</th>
                <th>Pull request</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="empty tk-empty">
                      <b>{filtered ? "No Runs match these filters" : "No Runs yet"}</b>
                      {filtered ? "Clear the filters to see every Run." : "Select Tickets and press Start to send them through a Flow."}
                    </div>
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const repo = r.ticketNumber === null ? r.key : r.key.slice(0, r.key.lastIndexOf("#"));
                return (
                  <tr key={r.id} className={`tk-row tone-${runStateLook(r.state)[0] || "mute"}${r.ticketNumber === null ? " from-input" : ""}`}
                    style={r.ticketNumber === null ? ({ "--c-in": outputColor(r.inputType ?? "") } as React.CSSProperties) : undefined}
                  >
                    <td className="tk-stub">
                      <StartedFrom ticketNumber={r.ticketNumber} inputType={r.inputType} inputNumber={r.inputNumber} />
                      <span className="tk-repo" style={{ "--c": tagColor(repo) } as React.CSSProperties}>
                        {repo}
                      </span>
                    </td>
                    <td className="t-title">
                      <Link href={`/runs/${r.id}`}>{r.ticketTitle}</Link>
                      <div className="tk-meta">
                        <span className="tk-flow">{r.flowName}</span>
                        <span className="faint">on {r.machine}</span>
                      </div>
                    </td>
                    <td className="nowrap">
                      <StatePill state={r.state} />
                    </td>
                    <td>
                      <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                        <Avatar name={r.starterName} email={r.starterEmail} picture={r.starterPicture} />
                        <span className="small nowrap">
                          {r.starterName ?? r.starterEmail}
                          <div className="faint">{ago(r.queuedAt, now)}</div>
                        </span>
                      </div>
                    </td>
                    <td className="num small nowrap tk-right">
                      {r.startedAt ? duration((r.endedAt ?? now).getTime() - r.startedAt.getTime()) : <span className="faint">—</span>}
                    </td>
                    <td className="nowrap">
                      {r.pullRequestNumber ? (
                        <span className={`tk-pr pr-${r.pullRequestState ?? "open"}`}>
                          #{r.pullRequestNumber} <span>{r.pullRequestState}</span>
                        </span>
                      ) : (
                        <span className="faint">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Suspense>
          <Pager page={page} size={paging.size} total={total} prev="Newer" next="Older" />
        </Suspense>
      </section>
    </>
  );
}

// A Run without a Ticket started from its Flow's Input; shown in the Input Type's colour, as on the Flow canvas.
const INPUT: Record<string, string> = { "pull-request": "Pull request", branch: "Branch", plan: "Plan", summary: "Summary" };

function StartedFrom({ ticketNumber, inputType, inputNumber }: { ticketNumber: number | null; inputType: string | null; inputNumber: number | null }) {
  if (ticketNumber !== null) return <span className="tk-num">#{ticketNumber}</span>;
  const type = inputType ?? "";
  return (
    <span className="tk-num tk-input" style={{ "--c": outputColor(type) } as React.CSSProperties} title={`Started from a ${(INPUT[type] ?? "Input").toLowerCase()} Input, no Ticket`}>
      {type === "pull-request" && inputNumber ? `PR #${inputNumber}` : (INPUT[type] ?? "Input")}
    </span>
  );
}
