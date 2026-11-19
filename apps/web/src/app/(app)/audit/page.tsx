import Link from "next/link";
import { Suspense } from "react";
import { formatTime } from "../../../components/format";
import { viewAudit } from "../../../server/runs";
import { deps, requireMember } from "../../../server/runtime";
import { FilterSelect } from "../runs/filters";

export const dynamic = "force-dynamic";

type Search = { member?: string; action?: string; page?: string };

const SUBJECT_LINK: Record<string, (id: string) => string> = {
  run: (id) => `/runs/${id}`,
  machine: (id) => `/machines/${id}`,
  flow: (id) => `/flows/${id}`,
};

/** One line of an entry's detail: its fields, without nesting. */
function detailText(detail: unknown): string {
  if (!detail || typeof detail !== "object") return "";
  return Object.entries(detail as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

/** The audit log (RUN-15, NFR-2, spec M3 §7): every recorded action, newest first. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireMember();
  const search = await searchParams;
  const { rows, hasMore, actors, actions, page, filters } = await viewAudit(deps(), search);
  const href = (change: Search) => {
    const query = new URLSearchParams(Object.entries({ ...search, ...change }).filter(([, v]) => v) as [string, string][]);
    return `/audit${query.size ? `?${query}` : ""}`;
  };
  const filtered = Boolean(filters.actorEmail || filters.action);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Audit log</h1>
          <p className="sub">Every action on Runs, Machines, Flows, Nodes and the allowlist, with who did it and when.</p>
        </div>
      </div>

      <div className="row">
        <Suspense>
          <FilterSelect name="member" label="All Members" options={actors.map((a) => ({ value: a, label: a }))} />
          <FilterSelect name="action" label="All actions" options={actions.map((a) => ({ value: a, label: a }))} />
        </Suspense>
        {filtered && (
          <Link className="btn ghost sm" href="/audit">
            Clear filters
          </Link>
        )}
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>When</th>
                <th>Member</th>
                <th>Action</th>
                <th>Subject</th>
                <th className="col-wide">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty">
                      <b>{filtered ? "No entries match these filters" : "Nothing recorded yet"}</b>
                    </div>
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const link = SUBJECT_LINK[r.subjectType]?.(r.subjectId);
                return (
                  <tr key={r.id} data-testid="audit-row">
                    <td className="small nowrap num">{formatTime(r.at)}</td>
                    <td className="small nowrap">{r.actorEmail}</td>
                    <td className="mono small nowrap">{r.action}</td>
                    <td className="small wrap-any">
                      {r.subjectType}{" "}
                      {link ? (
                        <Link className="mono" href={link}>
                          {r.subjectId.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="mono">{r.subjectId}</span>
                      )}
                    </td>
                    <td className="small faint wrap-any">
                      {detailText(r.detail)}
                    </td>
                  </tr>
                );
              })}
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
