import { notFound } from "next/navigation";
import { formatTime } from "../../../../components/format";
import { StatePill } from "../../../../components/state-pill";
import { viewRun } from "../../../../server/runs";
import { deps, gatewayUrl, requireMember } from "../../../../server/runtime";
import { RunLive } from "./run-live";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireMember();
  const run = await viewRun(deps(), id);
  if (run === "not-found") notFound();
  const r = run.run;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow mono">{run.key}</p>
          <h1>{run.ticket.title}</h1>
          <p className="sub">
            {run.snapshot.name} · started by {run.starter.name ?? run.starter.email} · on {run.podOwner.name ?? run.podOwner.email}&apos;s Pod ·{" "}
            <span className="tag">{r.mode}</span>
          </p>
        </div>
        <StatePill state={r.state} />
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="kv small">
          <span className="faint">Branch</span>
          <span className="mono">{r.branch ?? "—"}</span>
          <span className="faint">Pull request</span>
          <span>
            {r.pullRequestUrl ? (
              <a href={r.pullRequestUrl} target="_blank" rel="noreferrer">
                #{r.pullRequestNumber}
              </a>
            ) : (
              "—"
            )}
            {r.pullRequestState && <span className="faint"> · {r.pullRequestState}</span>}
          </span>
          <span className="faint">Queued · started · ended</span>
          <span className="num">
            {formatTime(r.queuedAt)} · {formatTime(r.startedAt)} · {formatTime(r.endedAt)}
          </span>
          {r.failureReason && (
            <>
              <span className="faint">Failure</span>
              <span className="err-text">{r.failureReason}</span>
            </>
          )}
        </div>
      </div>

      <RunLive gatewayUrl={gatewayUrl()} runId={r.id} timeline={run.timeline} />
    </>
  );
}
