import { POD_DEFAULTS } from "@clauderon/db";
import Link from "next/link";
import { ago } from "../../../components/format";
import { Icon } from "../../../components/icons";
import { viewPods, type PodView } from "../../../server/pods";
import { deps, requireMember } from "../../../server/runtime";
import { CreatePod } from "./create-pod";
import { defaultPodName, formatGb, LoginChip, podName, PodStatusChip, ReadyChip, SlotBar, SlotChips } from "./pod-parts";

export const dynamic = "force-dynamic";

export default async function PodsPage() {
  const member = await requireMember();
  const { host, pods, mine, limits, overCommitted, ceiling } = await viewPods(deps(), member);
  const others = pods.filter((p) => !p.mine);
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
        {!mine && <CreatePod defaults={POD_DEFAULTS} ceiling={ceiling} defaultName={defaultPodName(member)} />}
      </div>

      {mine && !mine.ready && (
        <div className="banner wait">
          <div className="grow small">
            <b>Your Pod is not Ready yet.</b> Runs start once it is running and logged in to Claude Code and GitHub. Its page does the
            logins with one button in the web terminal.
          </div>
          <Link className="btn sm primary" href={`/pods/${mine.id}`}>
            Set up my Pod
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
      </div>

      <h2>Your Pod</h2>
      <div className="pod-grid">
        {mine ? (
          <PodTile pod={mine} hostConnected={connected} now={now} />
        ) : (
          <div className="pod-tile new" data-testid="no-pod">
            <span style={{ color: "var(--fg2)" }}>{Icon.cube}</span>
            <b>You have no Pod yet</b>
            <span className="small faint">
              One container for you with its own Workspace. Its page then walks you through logging in to Claude Code and GitHub.
            </span>
            <CreatePod defaults={POD_DEFAULTS} ceiling={ceiling} defaultName={defaultPodName(member)} className="btn primary sm" />
          </div>
        )}
      </div>

      {others.length > 0 && (
        <>
          <h2>
            Team Pods <span className="faint num small">{others.length}</span>
          </h2>
          <div className="pod-grid compact" data-testid="team-pods">
            {others.map((pod) => (
              <TeamPodTile key={pod.id} pod={pod} hostConnected={connected} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** One Pod on the Pods page; the whole tile opens its Pod page. */
function PodTile({ pod, hostConnected, now }: { pod: PodView; hostConnected: boolean; now: Date }) {
  const up = pod.status === "running";
  return (
    <Link
      href={`/pods/${pod.id}`}
      className={`pod-tile ${pod.mine ? "mine" : ""} ${up && hostConnected ? "" : "off"}`}
      data-testid={pod.mine ? "my-pod" : undefined}
    >
      <div className="row between">
        <span style={{ color: "var(--fg2)" }}>{Icon.cube}</span>
        <PodStatusChip status={pod.status} hostConnected={hostConnected} />
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <h3>{podName(pod)}</h3>
        <div className="chips-row">
          <ReadyChip ready={pod.ready} />
          <span className="pill plain">{pod.mine ? `${pod.owner.name ?? pod.owner.email} · you` : pod.owner.email}</span>
        </div>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <div className="chips-row">
          <LoginChip ok={pod.claudeLoggedIn} label="Claude Code" />
          <LoginChip ok={pod.ghLoggedIn} label="gh" account={pod.ghAccount} />
        </div>
        <div className="small faint">
          <span className="mono">{pod.imageTag.split("/").at(-1)}</span> · {pod.cpus} CPU · {formatGb(pod.memoryMb)} RAM · checked{" "}
          {ago(pod.loginsCheckedAt, now)}
        </div>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <div className="chips-row">
          <SlotChips inUse={pod.inUse} slots={pod.slots} queued={pod.queued} />
        </div>
        <SlotBar slots={pod.slots} inUse={pod.inUse} />
      </div>
    </Link>
  );
}

/** Another Member's Pod: a smaller tile with status, Ready and Slots only. */
function TeamPodTile({ pod, hostConnected }: { pod: PodView; hostConnected: boolean }) {
  const up = pod.status === "running" && hostConnected;
  return (
    <Link href={`/pods/${pod.id}`} className={`pod-tile compact ${up ? "" : "off"}`}>
      <div className="row between" style={{ flexWrap: "nowrap" }}>
        <h3 className="clip">{podName(pod)}</h3>
        <PodStatusChip status={pod.status} hostConnected={hostConnected} />
      </div>
      <span className="small faint clip">{pod.owner.email}</span>
      <div className="chips-row">
        <ReadyChip ready={pod.ready} />
        <SlotChips inUse={pod.inUse} slots={pod.slots} queued={pod.queued} />
      </div>
    </Link>
  );
}
