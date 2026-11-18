import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ago } from "../../../../components/format";
import { Icon } from "../../../../components/icons";
import { PodPill, StatePill } from "../../../../components/state-pill";
import { viewPod } from "../../../../server/pods";
import { deps, gatewayUrl, requireMember } from "../../../../server/runtime";
import { AutoRefresh } from "../auto-refresh";
import { CmdBox } from "../cmd-box";
import { ConnectLogin } from "../connect-login";
import { PodActions } from "../pod-actions";
import { PodLimits } from "../pod-limits";
import { RemovePod } from "../remove-pod";
import type { LoginTool } from "../../../../components/pod-login-output";
import { SETUP_COMMANDS, type SetupStep } from "../../../../server/pod-setup";
import { defaultPodName, formatGb, podName, PodStatusChip, ReadyChip, SlotBar, SlotChips } from "../pod-parts";

export const dynamic = "force-dynamic";

const loginChip = (ok: boolean, label: string) =>
  ok ? (
    <span className="pill ok plain">
      {Icon.check}
      {label}
    </span>
  ) : (
    <span className="pill fail">Not logged in</span>
  );

type GuidePod = { id: string; status: string; claudeLoggedIn: boolean; ghLoggedIn: boolean; ghAccount: string | null };

const terminalHref = (podId: string, step: SetupStep) => `/pods/${podId}/terminal?run=${step}`;

/**
 * The way from a new Pod to Pod Ready (POD-5): one button runs every login
 * left in the web terminal; the steps below fix one thing at a time.
 */
function SetupGuide({ pod, hostConnected, gatewayUrl }: { pod: GuidePod; hostConnected: boolean; gatewayUrl: string }) {
  const running = pod.status === "running" && hostConnected;
  const steps: { done: boolean; title: string; detail: string; tool?: LoginTool }[] = [
    {
      done: pod.status === "running",
      title: "Container running",
      detail:
        pod.status === "running"
          ? "Your Pod is up."
          : pod.status === "creating"
            ? "The Host Agent is creating it; the first time pulls the Pod image and can take a minute."
            : pod.status === "error"
              ? "It failed to start. Press Start above to try again."
              : "It is stopped. Press Start above.",
    },
    {
      done: pod.claudeLoggedIn,
      title: "Claude Code",
      detail: pod.claudeLoggedIn ? "Connected." : "Runs use your own Claude account: sign in on claude.com, then paste the code it shows.",
      tool: "claude",
    },
    {
      done: pod.ghLoggedIn,
      title: "GitHub",
      detail: pod.ghLoggedIn ? `Connected as ${pod.ghAccount ?? "your account"}.` : "Runs push and open pull requests as you: copy a code, paste it on GitHub.",
      tool: "gh",
    },
  ];

  return (
    <div className="card card-pad stack" data-testid="pod-setup">
      <span className="eyebrow">Get this Pod Ready</span>
      <span className="small muted">Connect your accounts. No terminal needed; each takes about a minute.</span>
      <ol className="setup-steps">
        {steps.map((s) => (
          <li key={s.title}>
            <span className={`ndot ${s.done ? "succeeded" : ""}`}>{s.done && Icon.check}</span>
            <div className="stack" style={{ gap: 8 }}>
              <span className="small">
                <b>{s.title}</b>
              </span>
              <span className="small faint">{s.detail}</span>
              {!s.done && s.tool && running && <ConnectLogin gatewayUrl={gatewayUrl} podId={pod.id} tool={s.tool} />}
              {!s.done && s.tool && !running && <span className="small faint">Available once the container is running.</span>}
            </div>
          </li>
        ))}
      </ol>
      <details className="small">
        <summary className="faint">Prefer the terminal?</summary>
        <div className="stack" style={{ gap: 8, marginTop: 8 }}>
          <span className="faint">One command logs in to whatever is left and skips what is already done.</span>
          <CmdBox command={SETUP_COMMANDS.setup} />
          {running && (
            <div className="row">
              <Link className="btn sm" href={terminalHref(pod.id, "setup")}>
                {Icon.terminal}
                Run it in the web terminal
              </Link>
            </div>
          )}
        </div>
      </details>
      <p className="faint small">Logins stay in your Pod&apos;s Workspace. This page updates by itself until your Pod is Ready.</p>
    </div>
  );
}

export default async function PodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await requireMember();
  const view = await viewPod(deps(), member, id);
  if (view === "not-found") notFound();
  const { pod, using, hostConnected, ceiling, canRemove } = view;
  const now = new Date();
  const up = pod.status === "running" && hostConnected;
  const owner = pod.owner.name ?? pod.owner.email;
  const waiting = using.filter((r) => r.state === "waiting_for_human").length;
  // Each check ends in a chip: green when done, red or amber with what is wrong.
  const checks: [ok: boolean, label: string, chip: ReactNode][] = [
    [hostConnected, "Host Agent", hostConnected ? <span className="pill ok">Connected</span> : <span className="pill fail">Offline</span>],
    [pod.status === "running", "Container", <PodPill key="status" status={pod.status} />],
    [pod.claudeLoggedIn, "Claude Code", loginChip(pod.claudeLoggedIn, "Logged in")],
    [pod.ghLoggedIn, "gh", loginChip(pod.ghLoggedIn, pod.ghAccount ?? "Logged in")],
  ];
  const settings = {
    podId: pod.id,
    name: pod.name,
    defaultName: defaultPodName(pod.owner),
    limits: { slots: pod.slots, cpus: pod.cpus, memoryMb: pod.memoryMb },
    ceiling,
  };

  return (
    <>
      <div>
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/pods">Pods</Link> / <span>{podName(pod)}</span>
        </nav>
        <div className="page-head">
          <div>
            <h1 className="row" style={{ gap: 10 }}>
              <span style={{ color: "var(--fg2)" }}>{Icon.cube}</span>
              {podName(pod)}
            </h1>
            <div className="chips-row" style={{ marginTop: 8 }} data-testid="pod-chips">
              <PodStatusChip status={pod.status} hostConnected={hostConnected} />
              <ReadyChip ready={pod.ready} />
              <SlotChips inUse={pod.inUse} slots={pod.slots} queued={pod.queued} />
            </div>
            <p className="sub small" style={{ marginTop: 8 }}>
              <span className="mono" title={pod.id}>
                pod-{pod.id.slice(0, 8)}
              </span>{" "}
              · owner <b>{owner}</b>
              {pod.mine ? " (you)" : ""} · created {ago(pod.createdAt, now)}
            </p>
          </div>
          {pod.mine ? (
            <div className="row" style={{ gap: 6, alignItems: "flex-start" }}>
              <PodActions podId={pod.id} status={pod.status} busy={pod.inUse > 0} />
              <PodLimits {...settings} label="Settings…" small />
            </div>
          ) : (
            <span className="faint small">Only {owner} can manage this Pod.</span>
          )}
        </div>
      </div>

      {pod.mine && !pod.ready && <AutoRefresh everyMs={5000} />}
      {pod.mine && !pod.ready && <SetupGuide pod={pod} hostConnected={hostConnected} gatewayUrl={gatewayUrl()} />}

      <div className="grid g3">
        <div className="card card-pad stack" data-testid="pod-ready">
          <span className="eyebrow">Ready to run</span>
          <ul className="checklist">
            {checks.map(([ok, label, chip]) => (
              <li key={label}>
                <span className={`ndot ${ok ? "succeeded" : ""}`}>{ok && Icon.check}</span>
                <span className="small">{label}</span>
                {chip}
              </li>
            ))}
          </ul>
          <p className="faint small">
            Last checked {ago(pod.loginsCheckedAt, now)}
            {pod.tokenRepos.length > 0 ? ` · gh reaches ${pod.tokenRepos.join(", ")}` : " · gh reaches no Project yet"}
          </p>
        </div>

        <div className="card card-pad stack" data-testid="pod-slots">
          <div className="row between">
            <span className="eyebrow">Slots</span>
            {pod.mine && <PodLimits {...settings} label="Change…" small />}
          </div>
          <div className="big-num num">
            {pod.inUse}
            <span className="faint"> / {pod.slots}</span>
          </div>
          <SlotBar slots={pod.slots} inUse={pod.inUse} waiting={waiting} />
          <dl className="kv">
            <dt>Queued</dt>
            <dd>
              {pod.queued > 0 ? <span className="pill wait">{pod.queued} waiting</span> : <span className="pill plain">empty</span>}
              {!up && pod.queued > 0 && <span className="faint small"> · waits for the Pod to run</span>}
            </dd>
          </dl>
        </div>

        <div className="card card-pad stack">
          <span className="eyebrow">Container and Workspace</span>
          <dl className="kv">
            <dt>Image</dt>
            <dd className="mono small">{pod.imageTag.split("/").at(-1)}</dd>
            <dt>Digest</dt>
            <dd className="mono small">{pod.imageDigest ? pod.imageDigest.replace(/^sha256:/, "").slice(0, 12) : "—"}</dd>
            <dt>Container</dt>
            <dd className="mono small">{pod.containerId ? pod.containerId.slice(0, 12) : "—"}</dd>
            <dt>CPU</dt>
            <dd className="num">{pod.cpus}</dd>
            <dt>RAM</dt>
            <dd className="num">{formatGb(pod.memoryMb)}</dd>
          </dl>
          <p className="faint small">The Workspace keeps logins, Project clones and worktrees across Stop and Recreate.</p>
        </div>
      </div>

      <div className="grid g2">
        <div className="card" data-testid="pod-using">
          <div className="card-head">
            <h2>
              Using Slots <span className="faint num">{using.length}</span>
            </h2>
          </div>
          {using.length > 0 ? (
            <div className="tbl-wrap">
              <table className="tbl">
                <tbody>
                  {using.map((r) => (
                    <tr key={r.runId}>
                      <td className="nowrap">
                        <Link className="mono" href={`/runs/${r.runId}`}>
                          {r.key}
                        </Link>
                      </td>
                      <td className="small">{r.ticketTitle}</td>
                      <td>
                        <StatePill state={r.state} />
                      </td>
                      <td className="small faint nowrap">
                        {r.flowName} · {ago(r.startedAt ?? r.queuedAt, now)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">No Runs on this Pod right now.</div>
          )}
        </div>

        <div className="card" data-testid="pod-queue">
          <div className="card-head">
            <h2>
              Queue <span className="faint num">{pod.queue.length}</span>
            </h2>
            <span className="faint small">first-in, first-out</span>
          </div>
          {pod.queue.length > 0 ? (
            <div className="tbl-wrap">
              <table className="tbl">
                <tbody>
                  {pod.queue.map((q) => (
                    <tr key={q.runId}>
                      <td className="num faint">{q.position}</td>
                      <td className="nowrap">
                        <Link className="mono" href={`/runs/${q.runId}`}>
                          {q.key}
                        </Link>{" "}
                        {q.mode === "dry" && <span className="tag dry">Dry-run</span>}
                      </td>
                      <td className="small">{q.ticketTitle}</td>
                      <td className="small faint nowrap">
                        {q.flowName} · {ago(q.queuedAt, now)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">Nothing waiting.</div>
          )}
        </div>
      </div>

      {canRemove && <RemovePod podId={pod.id} podName={podName(pod)} mine={pod.mine} />}
    </>
  );
}
