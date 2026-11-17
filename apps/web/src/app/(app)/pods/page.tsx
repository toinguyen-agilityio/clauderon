import Link from "next/link";
import { Avatar } from "../../../components/brand";
import { ago } from "../../../components/format";
import { Icon } from "../../../components/icons";
import { PodPill } from "../../../components/state-pill";
import { viewPods, type PodView } from "../../../server/pods";
import { deps, requireMember } from "../../../server/runtime";
import { createPodAction } from "./actions";
import { PodActions } from "./pod-actions";

export const dynamic = "force-dynamic";

export default async function PodsPage() {
  const member = await requireMember();
  const { host, pods, mine, limits, overCommitted } = await viewPods(deps(), member);
  const now = new Date();
  const connected = host?.connected === true;
  const facts = host
    ? [
        host.dockerRunning ? "Docker running" : "Docker not reachable",
        host.arch,
        host.cpus && `${host.cpus} cores`,
        host.memoryMb && `${Math.round(host.memoryMb / 1024)} GB`,
        host.diskGb ? `${host.diskGb} GB disk` : null,
        host.agentVersion && `Host Agent ${host.agentVersion}`,
      ].filter(Boolean)
    : [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pods</h1>
          <p className="sub">
            Every Member has one Pod: a Docker container on the team&apos;s Pod Host, with their own Claude Code and gh logins. Runs you
            start always run on your Pod.
          </p>
        </div>
        {!mine && (
          <form action={createPodAction}>
            <button type="submit" className="btn primary">
              {Icon.plus}
              Create my Pod
            </button>
          </form>
        )}
      </div>

      {mine && mine.status === "running" && !(mine.claudeLoggedIn && mine.ghLoggedIn) && (
        <div className="banner wait">
          <div className="grow small">
            <b>Log in before you start Runs.</b> Open the terminal and run{" "}
            {!mine.claudeLoggedIn && <span className="mono">claude</span>}
            {!mine.claudeLoggedIn && !mine.ghLoggedIn && " and "}
            {!mine.ghLoggedIn && <span className="mono">gh auth login</span>} with your own accounts. Logins stay in your Workspace.
          </div>
          <Link className="btn sm primary" href={`/pods/${mine.id}/terminal`}>
            Open terminal
          </Link>
        </div>
      )}

      <div className="card host" data-testid="pod-host">
        <div className="host-head">
          <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
            <span style={{ color: "var(--fg2)" }}>{Icon.host}</span>
            <div>
              <h2>
                Pod Host{" "}
                <span className="faint small" style={{ fontWeight: 500 }}>
                  · one machine for every Pod
                </span>
              </h2>
              <p className="small faint" style={{ marginTop: 2 }}>
                {facts.length > 0 ? facts.join(" · ") : "The Host Agent has not connected yet."}
              </p>
            </div>
          </div>
          <div className="row">
            {connected ? <span className="pill ok">Host Agent connected</span> : <span className="pill fail">Host Agent offline</span>}
            <span className="faint small">
              {connected ? `last heartbeat ${ago(host?.lastHeartbeatAt ?? null, now)}` : `since ${ago(host?.lastHeartbeatAt ?? null, now)}`}
            </span>
          </div>
        </div>

        <p className="host-meters faint small">
          {pods.length} Pod{pods.length === 1 ? "" : "s"} · limits add up to {limits.cpus} of {host?.cpus ?? "?"} cores and {Math.round(limits.memoryMb / 1024)} of{" "}
          {host?.memoryMb ? Math.round(host.memoryMb / 1024) : "?"} GB
        </p>

        {!connected && (
          <div className="banner fail" style={{ margin: "0 16px" }}>
            <div className="grow small">
              <b>The Host Agent is not connected.</b> Nothing can start until it is. It reconnects by itself when the Pod Host is back
              online; if it never connected, install it with <span className="mono">scripts/install-host-agent.sh</span>.
            </div>
          </div>
        )}
        {overCommitted && (
          <div className="banner wait" style={{ margin: "0 16px" }}>
            <div className="grow small">
              <b>The Pods&apos; limits add up to more than the Pod Host has.</b> Pods still start; they share the machine when busy.
            </div>
          </div>
        )}

        <div className="pod-grid">
          {pods.map((pod) => (
            <PodTile key={pod.id} pod={pod} hostConnected={connected} now={now} />
          ))}
          {!mine && (
            <form action={createPodAction} className="pod-tile new">
              <span style={{ color: "var(--fg2)" }}>{Icon.cube}</span>
              <b>Create my Pod</b>
              <span className="small faint">One container for you: 2 Slots, 2 CPU, 4 GB, with its own Workspace.</span>
              <button type="submit" className="btn primary sm" style={{ marginTop: 6 }}>
                {Icon.plus}
                Create my Pod
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

function LoginRow({ ok, label, account }: { ok: boolean; label: string; account: string | null }) {
  return (
    <div className="login-row">
      <span className={`ndot sm ${ok ? "succeeded" : ""}`}>{ok && Icon.check}</span>
      <span>{label}</span>
      <span className={`acct ${ok && account ? "mono" : "faint"}`}>{ok ? (account ?? "logged in") : "not logged in"}</span>
    </div>
  );
}

function PodTile({ pod, hostConnected, now }: { pod: PodView; hostConnected: boolean; now: Date }) {
  const up = pod.status === "running";
  const owner = pod.owner.name ?? pod.owner.email;
  return (
    <div className={`pod-tile ${pod.mine ? "mine" : ""} ${up && hostConnected ? "" : "off"}`} data-testid={pod.mine ? "my-pod" : undefined}>
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <div className="row" style={{ gap: 8 }}>
          <Avatar name={pod.owner.name} email={pod.owner.email} picture={pod.owner.pictureUrl} />
          <div>
            <h3>{owner}&apos;s Pod</h3>
            <span className="faint small">{pod.mine ? "you" : pod.owner.email}</span>
          </div>
        </div>
        <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
          {hostConnected ? <PodPill status={pod.status} /> : <span className="pill intr">Unknown · agent offline</span>}
          {pod.ready && <span className="pill acc plain">Ready</span>}
        </div>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <div className="small">
          Image <span className="mono faint">{pod.imageTag.split("/").at(-1)}</span>
        </div>
        <LoginRow ok={pod.claudeLoggedIn} label="Claude Code" account={null} />
        <LoginRow ok={pod.ghLoggedIn} label="gh" account={pod.ghAccount} />
        <div className="small faint">
          {pod.tokenRepos.length > 0 ? `Reaches ${pod.tokenRepos.join(", ")}` : "Reaches no Project yet"} · checked {ago(pod.loginsCheckedAt, now)}
        </div>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <div className="row between small">
          <span>Slots</span>
          <span className="num faint">
            {pod.inUse}/{pod.slots} busy · {pod.queued} queued
          </span>
        </div>
        <div className="slots" aria-label={`${pod.inUse} of ${pod.slots} Slots busy`}>
          {Array.from({ length: pod.slots }, (_, i) => (
            <span key={i} className={`slot ${i < pod.inUse ? "run" : ""}`} />
          ))}
        </div>
      </div>

      {pod.mine && <PodActions podId={pod.id} status={pod.status} busy={pod.inUse > 0} />}
    </div>
  );
}
