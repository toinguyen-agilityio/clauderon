import Link from "next/link";
import { ago, formatTime } from "../../../../components/format";
import { viewDeletedFlows, viewFlows } from "../../../../server/flows";
import { viewLibrary } from "../../../../server/library";
import { deps, requireMember } from "../../../../server/runtime";
import { FlowsTabs } from "../flows-tabs";

export const dynamic = "force-dynamic";

/** Deleted Flows (issue #181): who deleted each and when. Their history stays reachable, and a version can be cloned. */
export default async function DeletedFlowsPage() {
  await requireMember();
  const [deleted, nodes, { samples, flows }] = await Promise.all([viewDeletedFlows(deps()), viewLibrary(deps()), viewFlows(deps())]);
  const now = new Date();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Flows</h1>
          <p className="sub">Flows that were deleted. Open one to see its history and clone it back as a new Flow.</p>
        </div>
      </div>
      <FlowsTabs active="deleted" flows={samples.length + flows.length} nodes={nodes.length} deleted={deleted.length} />
      <div className="card">
        {deleted.length === 0 ? (
          <div className="empty">
            <b>No deleted Flows</b>
          </div>
        ) : (
          <ul className="list" data-testid="deleted-flows">
            {deleted.map((d) => (
              <li key={d.flowId} className="row">
                <Link href={`/flows/${d.flowId}/history`}>
                  <b>{d.name}</b>
                </Link>
                <span className="small faint" title={formatTime(d.deletedAt)}>
                  Deleted by {d.deletedByName ?? d.deletedByEmail} · {ago(d.deletedAt, now)}
                </span>
                <Link className="btn ghost sm" href={`/flows/${d.flowId}/history/${d.versionId}`}>
                  Clone…
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
