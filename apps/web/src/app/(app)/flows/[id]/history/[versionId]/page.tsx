import Link from "next/link";
import { notFound } from "next/navigation";
import { formatTime } from "../../../../../../components/format";
import { viewFlowVersion, type SnapshotView } from "../../../../../../server/flows";
import { deps, requireMember } from "../../../../../../server/runtime";
import { VersionActions } from "../version-actions";

export const dynamic = "force-dynamic";

function Graph({ title, graph }: { title: string; graph: SnapshotView | null }) {
  return (
    <div className="card" data-testid={`graph-${title.toLowerCase()}`}>
      <h3>{title}</h3>
      {!graph ? (
        <p className="small faint">Nothing before this: it is the first version.</p>
      ) : (
        <>
          <p>
            <b>{graph.name}</b>
          </p>
          <ol className="small">
            {graph.nodes.map((n, i) => (
              <li key={i}>
                <b>{n.name}</b> <span className="faint">({n.kind})</span>
                {n.instructions && <pre className="mono small wrap-any">{n.instructions}</pre>}
                {n.extraInstructions && <pre className="mono small wrap-any">Extra: {n.extraInstructions}</pre>}
              </li>
            ))}
          </ol>
          <p className="small faint">Edges</p>
          <ul className="small">
            {graph.edges.length === 0 && <li className="faint">None</li>}
            {graph.edges.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** One change of a Flow, with the Flow before and after it, and Restore or Clone (issue #181). */
export default async function FlowVersionPage({ params }: { params: Promise<{ id: string; versionId: string }> }) {
  await requireMember();
  const { id, versionId } = await params;
  const uuid = /^[0-9a-f-]{36}$/i;
  const view = uuid.test(id) && uuid.test(versionId) ? await viewFlowVersion(deps(), id, versionId) : null;
  if (!view) notFound();
  const lockedReason = view.lock ? `Locked by Run ${view.lock.runId.slice(0, 6)} (${view.lock.state.replaceAll("_", " ")}).` : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            {view.entry.label}: {view.flowName}
          </h1>
          <p className="sub">
            {view.entry.actorName ?? view.entry.actorEmail} · {formatTime(view.entry.at)} · <Link href={`/flows/${id}/history`}>Back to History</Link>
          </p>
        </div>
      </div>
      {view.entry.summary.length > 0 && (
        <ul data-testid="version-summary">
          {view.entry.summary.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      <VersionActions flowId={id} versionId={versionId} flowExists={!view.deleted} lockedReason={lockedReason} />
      <div className="grid two">
        <Graph title="Before" graph={view.before} />
        <Graph title="After" graph={view.after} />
      </div>
    </>
  );
}
