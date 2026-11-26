import { isActive, renderRetryContext } from "@clauderon/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "../../../../components/brand";
import { ago, duration, formatTime, tokens } from "../../../../components/format";
import { Icon } from "../../../../components/icons";
import { runStateLook, StatePill } from "../../../../components/state-pill";
import { viewRun } from "../../../../server/runs";
import { deps, requireMember } from "../../../../server/runtime";
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

  const [tone] = runStateLook(r.state);
  const done = run.timeline.filter((n) => n.state === "succeeded").length;
  const prLabel = r.pullRequestNumber ? `#${r.pullRequestNumber}` : "Pull request";

  // The Run's state in a sentence, with what to do next: the strip along the bottom of the header.
  let verdict: { tone: string; body: React.ReactNode } | null = null;
  if (r.state === "failed")
    verdict = {
      tone: "fail",
      body: (
        <>
          <p>
            <b>Failed{failedAt ? ` at “${failedAt.name}”` : ""}</b>: {r.failureReason}
          </p>
          <p className="small">The Run stays Active and keeps its worktree, but frees its Slot. Pick a Node and use Retry from here, or Cancel it to end it for good.</p>
          {canSwitchClaude && (
            <p className="small muted" data-testid="switch-claude">
              Out of Claude usage, or signed in to the wrong account? Run <span className="mono">claude</span> in your own terminal on your Machine and sign in to
              another account, then Retry from a Node below.
            </p>
          )}
        </>
      ),
    };
  else if (r.state === "interrupted")
    verdict = {
      tone: "intr",
      body: (
        <>
          <p>
            <b>Interrupted{failedAt ? ` at “${failedAt.name}”` : ""}</b>: {r.failureReason}
          </p>
          <p className="small">Nothing is retried automatically. The Run keeps its worktree but not a Slot: Retry from a Node, or Cancel it.</p>
        </>
      ),
    };
  else if (r.state === "waiting_for_human")
    verdict = {
      tone: "wait",
      body: (
        <>
          <p>
            <b>Waiting for a person{waitingAt ? ` at “${waitingAt.name}”` : ""}</b>
          </p>
          <p className="small">Any Member can respond below or from Needs you. The Run keeps its Slot until someone does; there is no timeout.</p>
        </>
      ),
    };
  else if (r.state === "queued")
    verdict = {
      tone: "mute",
      body: (
        <>
          <p>
            <b>Queued on {machineLabel}</b>
          </p>
          <p className="small">Starts first-in, first-out when a Slot frees up and the Machine is online.</p>
        </>
      ),
    };
  else if (r.state === "running" && !r.branch) verdict = { tone: "info", body: <p>Checking the Machine&apos;s logins and preparing the worktree…</p> };
  else if (r.state === "cancelled") verdict = { tone: "mute", body: <p><b>Cancelled</b>. The Run ended for good and cannot be retried.</p> };
  else if (r.state === "succeeded")
    verdict = {
      tone: "ok",
      body: (
        <p>
          <b>Succeeded</b>
          {run.durationMs !== null && ` in ${duration(run.durationMs)}`}
          {r.pullRequestUrl ? (
            <>
              {" · pull request "}
              <a href={r.pullRequestUrl} target="_blank" rel="noreferrer" className="mono">
                {prLabel}
              </a>{" "}
              {r.pullRequestState === "merged" ? "merged" : "open for review on GitHub"}
            </>
          ) : (
            " · no changes, so no pull request"
          )}
        </p>
      ),
    };

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/runs">Runs</Link> / <span className="mono">{run.key}</span>
      </nav>

      <header className={`card run-head t-${tone || "mute"}`}>
        <div className="run-head-row">
          <div className="run-head-title">
            <div className="run-head-tags">
              <StatePill state={r.state} />
              {run.ticket ? (
                <a className="run-key" href={run.ticket.url} target="_blank" rel="noreferrer" title="Open the Ticket on GitHub">
                  {run.key} {Icon.external}
                </a>
              ) : (
                <span className="run-key">{run.key}</span>
              )}
            </div>
            <h1>{run.title}</h1>
            <p className="run-head-by">
              <Avatar name={run.starter.name} email={run.starter.email} picture={run.starter.pictureUrl} />
              <span>
                Started by <b>{run.starter.name ?? run.starter.email}</b>{" "}
                <time dateTime={r.createdAt.toISOString()} title={formatTime(r.createdAt)}>
                  {ago(r.createdAt, now)}
                </time>
                {" on "}
                {r.machineId && machineOwner ? <Link href={`/machines/${r.machineId}`}>{machineLabel}</Link> : <span className="faint">a removed Machine</span>}
              </span>
            </p>
          </div>
          {active && (
            <div className="run-head-actions">
              <CancelRun runId={r.id} running={r.state === "running"} />
            </div>
          )}
        </div>

        <dl className="run-facts">
          <Fact label="Flow" value={run.snapshot.name} sub={`${done} of ${run.timeline.length} Nodes done`} />
          <Fact label="Duration" value={<span className="num">{run.durationMs === null ? "—" : duration(run.durationMs)}</span>} sub={runningAt ? `running “${runningAt.name}”` : undefined} />
          <Fact label="Tokens" value={<span className="num">{run.tokens ? tokens(run.tokens) : "—"}</span>} />
          {active && (
            <Fact
              label="Machine disk"
              value={<span data-disk={disk.state}>{disk.text}</span>}
              sub={disk.state === "low" ? "low" : disk.state === "critical" ? "almost full" : undefined}
            />
          )}
          <Fact
            label="Branch"
            wide
            value={
              r.branch ? (
                <span className="mono run-branch" title={r.branch}>
                  {r.branch}
                </span>
              ) : (
                "—"
              )
            }
          />
          <Fact
            label="Pull request"
            value={
              r.pullRequestUrl ? (
                <a href={r.pullRequestUrl} target="_blank" rel="noreferrer" className="mono">
                  {prLabel}
                </a>
              ) : (
                "—"
              )
            }
            sub={r.pullRequestUrl ? (r.pullRequestState ?? undefined) : undefined}
          />
        </dl>

        {verdict && (
          <div className={`run-verdict is-${verdict.tone}`} role="status">
            {verdict.body}
          </div>
        )}
      </header>

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

      <section className="card run-body" aria-label="Nodes">
        <RunLive
          runId={r.id}
          snapshot={run.snapshot}
          timeline={run.timeline}
          runEnded={r.endedAt !== null}
          retryable={run.retryable}
          retryContext={run.retryContext ? renderRetryContext(run.retryContext) || null : null}
        />
      </section>

      <section className="card run-history" aria-labelledby="run-history-h">
        <h2 id="run-history-h">History</h2>
        {run.history.length === 0 ? (
          <p className="faint small">Nothing recorded yet.</p>
        ) : (
          <ol className="rh" aria-label="Run history">
            {run.history.map((h) => (
              <li key={h.id} className={`rh-item a-${h.action.replace("run.", "")}`}>
                <time className="rh-time" dateTime={h.at.toISOString()} title={formatTime(h.at)}>
                  {formatTime(h.at)}
                </time>
                <div className="rh-body">
                  <p>
                    <b title={h.action}>{ACTION[h.action] ?? h.action}</b>
                    {typeof h.detail.node === "string" && <> at “{h.detail.node}”</>}
                    <span className="rh-who"> by {h.actorEmail}</span>
                  </p>
                  {typeof h.detail.feedback === "string" && <q className="rh-quote">{h.detail.feedback}</q>}
                  {typeof h.detail.note === "string" && <q className="rh-quote">{h.detail.note}</q>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

/** What each recorded action reads as in the History. */
const ACTION: Record<string, string> = {
  "run.start": "Started",
  "run.approve": "Approved",
  "run.reject": "Rejected",
  "run.answer": "Answered",
  "run.continue": "Continued",
  "run.stop": "Stopped",
  "run.resume": "Resumed",
  "run.retry": "Retried",
  "run.cancel": "Cancelled",
};

function Fact({ label, value, sub, wide }: { label: string; value: React.ReactNode; sub?: string; wide?: boolean }) {
  return (
    <div className={`run-fact${wide ? " is-wide" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      {sub && <dd className="run-fact-sub">{sub}</dd>}
    </div>
  );
}
