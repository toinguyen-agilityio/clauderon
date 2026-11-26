import Link from "next/link";
import { notFound } from "next/navigation";
import { ago, formatTime } from "../../../../../components/format";
import { Tabs } from "../../../../../components/tabs";
import { viewFlowHistory } from "../../../../../server/flows";
import { deps, requireMember } from "../../../../../server/runtime";

export const dynamic = "force-dynamic";

/** The History tab of a Flow (issue #181): every change, newest first. It also opens for a deleted Flow. */
export default async function FlowHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireMember();
  const { id } = await params;
  const view = /^[0-9a-f-]{36}$/i.test(id) ? await viewFlowHistory(deps(), id) : null;
  if (!view) notFound();
  const now = new Date();

  return (
    <>
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
        <div className="notice wait" data-testid="lock-banner">
          Locked by Run <Link href={`/runs/${view.lock.runId}`}>{view.lock.runId.slice(0, 6)}</Link> ({view.lock.state.replaceAll("_", " ")}). An earlier version can be restored when that Run ends.
        </div>
      )}
      <div className="card">
        <ul className="list" data-testid="history-list">
          {view.entries.map((e) => (
            <li key={e.id} data-testid="history-entry">
              <div className="row">
                <b>{e.label}</b>
                <span className="small faint" title={formatTime(e.at)}>
                  {e.actorName ?? e.actorEmail} · {ago(e.at, now)}
                </span>
                <Link className="btn ghost sm" href={`/flows/${view.flowId}/history/${e.id}`}>
                  Open
                </Link>
              </div>
              {e.clonedFrom && (
                <p className="small faint">
                  From <Link href={`/flows/${e.clonedFrom}/history`}>another Flow</Link>
                </p>
              )}
              {e.summary.length > 0 && (
                <ul className="small">
                  {e.summary.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
