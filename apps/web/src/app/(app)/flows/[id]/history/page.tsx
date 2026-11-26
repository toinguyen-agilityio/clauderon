import Link from "next/link";
import { notFound } from "next/navigation";
import { ago, formatTime } from "../../../../../components/format";
import { Tabs } from "../../../../../components/tabs";
import { viewFlowHistory } from "../../../../../server/flows";
import { deps, requireMember } from "../../../../../server/runtime";

export const dynamic = "force-dynamic";

/** Summary lines shown per change before "and N more". */
const SHOWN = 3;

/** The History tab of a Flow (issue #181): every change, newest first, as a revision log. It also opens for a deleted Flow. */
export default async function FlowHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireMember();
  const { id } = await params;
  const view = /^[0-9a-f-]{36}$/i.test(id) ? await viewFlowHistory(deps(), id) : null;
  if (!view) notFound();
  const now = new Date();
  const seqOf = new Map(view.entries.map((e) => [e.id, e.seq]));

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/flows">Flows</Link> / {view.deleted ? <span>{view.name}</span> : <Link href={`/flows/${view.flowId}`}>{view.name}</Link>} / <span>History</span>
      </nav>
      <div className="page-head">
        <div>
          <h1>{view.name}</h1>
          <p className="sub">
            {view.deleted
              ? "This Flow was deleted. Its history stays here: open a version to clone it as a new Flow."
              : "Every change to this Flow, with who made it and what changed. Open a change to see the Flow before and after it."}
          </p>
        </div>
      </div>
      <Tabs
        label="Flow"
        tabs={[
          ...(view.deleted ? [] : [{ href: `/flows/${view.flowId}`, label: "Editor", active: false }]),
          { href: `/flows/${view.flowId}/history`, label: "History", count: view.entries.length, active: true },
        ]}
      />
      {view.lock && (
        <div className="banner wait" data-testid="lock-banner">
          <div className="grow small">
            <b>
              Locked by Run <Link href={`/runs/${view.lock.runId}`}>{view.lock.runId.slice(0, 6)}</Link> ({view.lock.state.replaceAll("_", " ")}).
            </b>{" "}
            An earlier version can be restored when that Run ends.
          </div>
        </div>
      )}

      <ol className="hl" data-testid="history-list">
        {view.entries.map((e, i) => {
          const current = i === 0 && !view.deleted;
          const restoredFrom = e.restoredFromVersionId ? seqOf.get(e.restoredFromVersionId) : undefined;
          const more = e.summary.length - SHOWN;
          return (
            <li key={e.id} className={`hl-item${current ? " is-current" : ""}`} data-testid="history-entry">
              <span className="hl-stamp" aria-hidden>
                {e.seq}
              </span>
              <div className="card hl-card">
                <div className="hl-top">
                  <span className={`ver-kind k-${e.kind}`}>{e.label}</span>
                  {current && <span className="hl-current">Current</span>}
                  <Link className="hl-open" href={`/flows/${view.flowId}/history/${e.id}`}>
                    Version {e.seq}
                    <span className="sr-only">: {e.label}, open</span>
                    <span aria-hidden>→</span>
                  </Link>
                </div>
                {e.summary.length > 0 && (
                  <ul className="hl-summary">
                    {e.summary.slice(0, SHOWN).map((line, j) => (
                      <li key={j}>{line}</li>
                    ))}
                    {more > 0 && (
                      <li className="hl-more">
                        and {more} more change{more === 1 ? "" : "s"}
                      </li>
                    )}
                  </ul>
                )}
                {(e.clonedFrom || restoredFrom !== undefined) && (
                  <p className="hl-origin">
                    {e.clonedFrom && (
                      <>
                        From <Link href={`/flows/${e.clonedFrom}/history`}>another Flow</Link>
                      </>
                    )}
                    {restoredFrom !== undefined && (
                      <>
                        Restored from <Link href={`/flows/${view.flowId}/history/${e.restoredFromVersionId}`}>version {restoredFrom}</Link>
                      </>
                    )}
                  </p>
                )}
                <p className="hl-meta">
                  <b>{e.actorName ?? e.actorEmail}</b>
                  <span aria-hidden>·</span>
                  <time dateTime={e.at.toISOString()} title={formatTime(e.at)}>
                    {ago(e.at, now)}
                  </time>
                  <span className="hl-when">{formatTime(e.at)}</span>
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
