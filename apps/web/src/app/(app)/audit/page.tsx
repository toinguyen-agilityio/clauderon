import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "../../../components/brand";
import { APP_TIME_ZONE, APP_TIME_ZONE_LABEL, formatTime } from "../../../components/format";
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

/** Each recorded action as a sentence; an action not listed here shows as it is stored. */
const ACTIONS: Record<string, string> = {
  "run.start": "started",
  "run.cancel": "cancelled",
  "run.retry": "retried",
  "machine.pair": "paired",
  "machine.unpair": "unpaired",
  "machine.remove": "removed",
  "machine.settings": "changed the settings of",
  "flow.create": "created",
  "flow.update": "updated",
  "flow.delete": "deleted",
  "node.create": "created",
  "node.update": "updated",
  "node.delete": "deleted",
  "project.enable": "enabled",
  "project.remove": "removed",
  "allowlist.add": "added",
  "allowlist.remove": "removed",
  "github.token.set": "set the GitHub token",
  "github.token.remove": "removed the GitHub token",
};

/** What follows the subject, for actions whose sentence goes on after it. */
const AFTER: Record<string, string> = { "allowlist.add": "to the allowlist", "allowlist.remove": "from the allowlist" };

const SUBJECT_NAME: Record<string, string> = { run: "Run", machine: "Machine", flow: "Flow", node: "Node", project: "Project" };

/** The area an action belongs to, which picks its colour on the timeline. */
const area = (action: string) => action.split(".")[0] ?? "";

/** An entry's detail as key and value pairs, without nesting. */
function detailPairs(detail: unknown): [string, string][] {
  if (!detail || typeof detail !== "object") return [];
  return Object.entries(detail as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v)]);
}

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabel = new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const clock = new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false });

/** The audit log (RUN-15, NFR-2, spec M3 §7): every recorded action, newest first, by day. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireMember();
  const search = await searchParams;
  const { rows, hasMore, actors, actions, page, filters } = await viewAudit(deps(), search);
  const href = (change: Search) => {
    const query = new URLSearchParams(Object.entries({ ...search, ...change }).filter(([, v]) => v) as [string, string][]);
    return `/audit${query.size ? `?${query}` : ""}`;
  };
  const filtered = Boolean(filters.actorEmail || filters.action);

  const now = new Date();
  const today = dayKey.format(now);
  const yesterday = dayKey.format(new Date(now.getTime() - 86_400_000));
  const days: { key: string; label: string; entries: typeof rows }[] = [];
  for (const r of rows) {
    const key = dayKey.format(r.at);
    let day = days.at(-1);
    if (day?.key !== key) {
      day = { key, label: key === today ? "Today" : key === yesterday ? "Yesterday" : dayLabel.format(r.at), entries: [] };
      days.push(day);
    }
    day.entries.push(r);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Audit log</h1>
          <p className="sub">Every action on Runs, Machines, Flows, Nodes, Projects and the allowlist, with who did it and when.</p>
        </div>
        <p className="tk-synced small">Times in {APP_TIME_ZONE_LABEL}</p>
      </div>

      <section className="tk-board audit-board" aria-label="Audit log">
        <div className="tk-toolbar">
          <div className="tk-tools">
            <Suspense>
              <FilterSelect name="member" label="All Members" options={actors.map((a) => ({ value: a, label: a }))} />
              <FilterSelect
                name="action"
                label="All actions"
                options={actions.map((a) => ({ value: a, label: ACTIONS[a] ? `${SUBJECT_NAME[area(a)] ?? area(a)}: ${ACTIONS[a]}${AFTER[a] ? ` ${AFTER[a]}` : ""}` : a }))}
              />
            </Suspense>
            {filtered && (
              <Link className="btn ghost sm" href="/audit">
                Clear filters
              </Link>
            )}
          </div>
        </div>

        {rows.length === 0 && (
          <div className="empty tk-empty">
            <b>{filtered ? "No entries match these filters" : "Nothing recorded yet"}</b>
            {filtered ? "Clear the filters to see every entry." : "Starting a Run, pairing a Machine or editing a Flow shows up here."}
          </div>
        )}

        {days.map((day) => (
          <section key={day.key} className="audit-day" aria-label={day.label}>
            <h2 className="audit-day-h">
              {day.label}
              <span className="n">{day.entries.length}</span>
            </h2>
            <ol className="audit-list">
              {day.entries.map((r) => {
                const link = SUBJECT_LINK[r.subjectType]?.(r.subjectId);
                const verb = ACTIONS[r.action];
                const noun = SUBJECT_NAME[r.subjectType];
                const pairs = detailPairs(r.detail);
                // An allowlist entry or the GitHub token reads as part of the sentence; other subjects are linked by id.
                const subject =
                  r.subjectType === "allowlist_entry" ? (
                    <b>{r.subjectId}</b>
                  ) : r.subjectType === "github" ? null : (
                    <>
                      {noun ?? r.subjectType}{" "}
                      {link ? (
                        <Link className="mono audit-id" href={link}>
                          {r.subjectId.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="mono audit-id">{r.subjectId.slice(0, 8)}</span>
                      )}
                    </>
                  );
                return (
                  <li key={r.id} className={`audit-entry a-${area(r.action)}`} data-testid="audit-row">
                    <time className="audit-time num" dateTime={r.at.toISOString()} title={formatTime(r.at)}>
                      {clock.format(r.at)}
                    </time>
                    <span className="audit-dot" aria-hidden />
                    <div className="audit-body">
                      <p className="audit-line">
                        <Avatar name={null} email={r.actorEmail} picture={null} />
                        <span>
                          <b>{r.actorEmail}</b> {verb ?? r.action} {subject}
                          {AFTER[r.action] && ` ${AFTER[r.action]}`}
                        </span>
                      </p>
                      {pairs.length > 0 && (
                        <dl className="audit-detail">
                          {pairs.map(([k, v]) => (
                            <div key={k} title={v}>
                              <dt>{k}</dt>
                              <dd>{v}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                    <code className="audit-action">{r.action}</code>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}

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
      </section>
    </>
  );
}
