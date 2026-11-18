import { isActive } from "@clauderon/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "../../../../components/brand";
import { ago, duration, tokens } from "../../../../components/format";
import { Icon } from "../../../../components/icons";
import { StatePill } from "../../../../components/state-pill";
import { viewRun } from "../../../../server/runs";
import { deps, gatewayUrl, requireMember } from "../../../../server/runtime";
import { CancelRun } from "./cancel-run";
import { RunLive } from "./run-live";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireMember();
  const run = await viewRun(deps(), id);
  if (run === "not-found") notFound();
  const r = run.run;
  const now = new Date();
  const podOwner = run.podOwner ? (run.podOwner.name ?? run.podOwner.email) : null;
  const podLabel = run.podName ?? `${podOwner}'s Pod`;
  const failedAt = run.timeline.find((n) => n.state === "failed");
  const runningAt = run.timeline.find((n) => n.state === "running");
  const active = isActive(r.state);

  return (
    <>
      <div>
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/runs">Runs</Link> / <span className="mono">{run.key}</span>
        </nav>
        <div className="page-head">
          <div className="grow">
            <h1>{run.ticket.title}</h1>
            <div className="row" style={{ marginTop: 8 }}>
              <StatePill state={r.state} />
              <span className={`tag ${r.mode === "dry" ? "dry" : "real"}`}>{r.mode === "dry" ? "Dry-run" : "Real"}</span>
              <a className="mono small row" style={{ gap: 4 }} href={run.ticket.url} target="_blank" rel="noreferrer">
                {run.key} {Icon.external}
              </a>
              <span className="faint">·</span>
              <span className="small">{run.snapshot.name}</span>
              <span className="faint">·</span>
              {r.podId && podOwner ? (
                <Link className="small" href={`/pods/${r.podId}`}>
                  {podLabel}
                </Link>
              ) : (
                <span className="small faint">Pod removed</span>
              )}
              <span className="faint">·</span>
              <span className="row" style={{ gap: 6 }}>
                <Avatar name={run.starter.name} email={run.starter.email} picture={run.starter.pictureUrl} />
                <span className="small">
                  started by <b>{run.starter.name ?? run.starter.email}</b> {ago(r.queuedAt, now)}
                </span>
              </span>
            </div>
          </div>
          {active && <CancelRun runId={r.id} running={r.state === "running"} />}
        </div>
      </div>

      {r.state === "failed" && (
        <div className="banner fail" role="status">
          <div className="grow">
            <p>
              <b>Failed{failedAt ? ` at “${failedAt.name}”` : ""}</b>: {r.failureReason}
            </p>
            <p className="small">The Run stays Active and keeps its worktree, but frees its Slot. Cancel it to end it for good; Retry arrives in M3.</p>
          </div>
        </div>
      )}
      {r.state === "queued" && (
        <div className="banner" role="status">
          <div className="grow">
            <p>
              <b>Queued on {podLabel}</b>
            </p>
            <p className="small muted">Starts first-in, first-out when a Slot frees up and the Pod is running.</p>
          </div>
        </div>
      )}
      {r.state === "running" && !r.branch && (
        <div className="banner info" role="status">
          <div className="grow small">Checking the Pod&apos;s logins and preparing the worktree…</div>
        </div>
      )}
      {r.state === "cancelled" && (
        <div className="banner" role="status">
          <div className="grow">
            <p>
              <b>Cancelled</b>
            </p>
          </div>
        </div>
      )}
      {r.state === "succeeded" && (
        <div className="banner ok" role="status">
          <div className="grow">
            <p>
              <b>Succeeded</b>
              {run.durationMs !== null && ` in ${duration(run.durationMs)}`}
              {r.pullRequestUrl ? (
                <>
                  {" · pull request "}
                  <a href={r.pullRequestUrl} target="_blank" rel="noreferrer" className="mono">
                    #{r.pullRequestNumber}
                  </a>{" "}
                  {r.pullRequestState === "merged" ? "merged" : "open for review on GitHub"}
                </>
              ) : (
                " · no changes, so no pull request"
              )}
            </p>
          </div>
        </div>
      )}

      <div className="stats">
        <Stat label="Duration" value={run.durationMs === null ? "—" : duration(run.durationMs)} sub={runningAt ? `running “${runningAt.name}”` : undefined} />
        <Stat label="Tokens" value={run.tokens ? tokens(run.tokens) : "—"} />
        <Stat label="Branch" value={r.branch ? <span className="mono" style={{ fontSize: 12 }}>{r.branch}</span> : "—"} />
        <Stat
          label="Pull request"
          value={
            r.pullRequestUrl ? (
              <a href={r.pullRequestUrl} target="_blank" rel="noreferrer" className="mono">
                #{r.pullRequestNumber}
              </a>
            ) : (
              "—"
            )
          }
          sub={r.pullRequestState ?? undefined}
        />
      </div>

      <div className="card">
        <RunLive gatewayUrl={gatewayUrl()} runId={r.id} timeline={run.timeline} runEnded={r.endedAt !== null} />
      </div>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card stat">
      <span className="eyebrow">{label}</span>
      <span className="v">{value}</span>
      {sub && <span className="faint small">{sub}</span>}
    </div>
  );
}
