import { isActive, renderRetryContext } from "@clauderon/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "../../../../components/brand";
import { ago, duration, formatTime, tokens } from "../../../../components/format";
import { Icon } from "../../../../components/icons";
import { StatePill } from "../../../../components/state-pill";
import { viewRun } from "../../../../server/runs";
import { deps, gatewayUrl, requireMember } from "../../../../server/runtime";
import { DISK_ADVICE, diskFree } from "../../machines/machine-parts";
import { CancelRun } from "./cancel-run";
import { RunLive } from "./run-live";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await requireMember();
  const run = await viewRun(deps(), id);
  if (run === "not-found") notFound();
  const r = run.run;
  const now = new Date();
  const machineOwner = run.machineOwner ? (run.machineOwner.name ?? run.machineOwner.email) : null;
  const machineLabel = run.machineName ?? `${machineOwner}'s Machine`;
  const failedAt = run.timeline.find((n) => n.state === "failed" || n.state === "interrupted");
  const waitingAt = run.timeline.find((n) => n.openRequest);
  const runningAt = run.timeline.find((n) => n.state === "running");
  const active = isActive(r.state);
  const disk = diskFree({ connected: run.machineConnected ?? false, usage: run.machineUsage });
  // A failed Agent Node may be out of Claude usage or logged out: its Machine's
  // owner can sign in to another Claude account on it, then Retry (POD-5).
  // Only when Claude Code itself failed (usage limit, logged out); not for
  // "no commit on the branch" or a missing result block.
  const claudeFailed = /^Claude Code exited/.test(r.failureReason ?? "");
  const canSwitchClaude = r.state === "failed" && failedAt?.kind === "agent" && claudeFailed && run.machineOwnerId === member.id;

  return (
    <>
      <div>
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/runs">Runs</Link> / <span className="mono">{run.key}</span>
        </nav>
        <div className="page-head">
          <div className="grow">
            <h1>{run.title}</h1>
            <div className="row" style={{ marginTop: 8 }}>
              <StatePill state={r.state} />
              {run.ticket ? (
                <a className="mono small row" style={{ gap: 4 }} href={run.ticket.url} target="_blank" rel="noreferrer">
                  {run.key} {Icon.external}
                </a>
              ) : (
                <span className="mono small">{run.key}</span>
              )}
              <span className="faint">·</span>
              <span className="small">{run.snapshot.name}</span>
              <span className="faint">·</span>
              {r.machineId && machineOwner ? (
                <Link className="small" href={`/machines/${r.machineId}`}>
                  {machineLabel}
                </Link>
              ) : (
                <span className="small faint">Machine removed</span>
              )}
              <span className="faint">·</span>
              <span className="row" style={{ gap: 6 }}>
                <Avatar name={run.starter.name} email={run.starter.email} picture={run.starter.pictureUrl} />
                <span className="small">
                  started by <b>{run.starter.name ?? run.starter.email}</b> {ago(r.createdAt, now)}
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
            <p className="small">The Run stays Active and keeps its worktree, but frees its Slot. Pick a Node and use Retry from here, or Cancel it to end it for good.</p>
            {canSwitchClaude && (
              <p className="small muted" style={{ marginTop: 10 }} data-testid="switch-claude">
                Out of Claude usage, or signed in to the wrong account? Run <span className="mono">claude</span> in your own terminal on your
                Machine and sign in to another account, then Retry from a Node below.
              </p>
            )}
          </div>
        </div>
      )}
      {r.state === "interrupted" && (
        <div className="banner intr" role="status">
          <div className="grow">
            <p>
              <b>Interrupted{failedAt ? ` at “${failedAt.name}”` : ""}</b>: {r.failureReason}
            </p>
            <p className="small">Nothing is retried automatically. The Run keeps its worktree but not a Slot: Retry from a Node, or Cancel it.</p>
          </div>
        </div>
      )}
      {active && (disk.state === "low" || disk.state === "critical") && (
        <div className={`banner ${disk.state === "critical" ? "fail" : "wait"}`} role="status" data-testid="disk-banner">
          <div className="grow">
            <p>
              <b>{disk.state === "critical" ? "Disk almost full" : "Low disk"} on {machineLabel}: {disk.text}</b>
            </p>
            <p className="small">{DISK_ADVICE} Cancel the Run above to stop it.</p>
          </div>
        </div>
      )}
      {r.state === "waiting_for_human" && (
        <div className="banner wait" role="status">
          <div className="grow">
            <p>
              <b>Waiting for a person{waitingAt ? ` at “${waitingAt.name}”` : ""}</b>
            </p>
            <p className="small">Any Member can respond below or from Needs you. The Run keeps its Slot until someone does; there is no timeout.</p>
          </div>
        </div>
      )}
      {r.state === "queued" && (
        <div className="banner" role="status">
          <div className="grow">
            <p>
              <b>Queued on {machineLabel}</b>
            </p>
            <p className="small muted">Starts first-in, first-out when a Slot frees up and the Machine is online.</p>
          </div>
        </div>
      )}
      {r.state === "running" && !r.branch && (
        <div className="banner info" role="status">
          <div className="grow small">Checking the Machine&apos;s logins and preparing the worktree…</div>
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
        <Stat label="Machine disk" value={active ? <span data-disk={disk.state}>{disk.text}</span> : "—"} sub={disk.state === "low" ? "low" : disk.state === "critical" ? "almost full" : undefined} />
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
        <RunLive
          gatewayUrl={gatewayUrl()}
          runId={r.id}
          timeline={run.timeline}
          runEnded={r.endedAt !== null}
          retryable={run.retryable}
          retryContext={run.retryContext ? renderRetryContext(run.retryContext) || null : null}
        />
      </div>

      <div className="card card-pad stack" style={{ gap: 10 }}>
        <span className="eyebrow">History</span>
        {run.history.length === 0 ? (
          <span className="faint small">Nothing recorded yet.</span>
        ) : (
          <ul className="history" aria-label="Run history">
            {run.history.map((h) => (
              <li key={h.id}>
                <span className="faint num nowrap">{formatTime(h.at)}</span>
                <span className="mono">{h.action}</span>
                <span>{h.actorEmail}</span>
                {typeof h.detail.node === "string" && <span className="faint">at “{h.detail.node}”</span>}
                {typeof h.detail.feedback === "string" && <span className="faint">: {h.detail.feedback}</span>}
                {typeof h.detail.note === "string" && <span className="faint">: {h.detail.note}</span>}
              </li>
            ))}
          </ul>
        )}
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
