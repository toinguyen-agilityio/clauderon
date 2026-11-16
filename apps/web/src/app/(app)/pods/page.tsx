import { Avatar } from "../../../components/brand";
import { ago } from "../../../components/format";
import { Icon } from "../../../components/icons";
import { StatePill } from "../../../components/state-pill";
import { viewPods } from "../../../server/pods";
import { deps, requireMember } from "../../../server/runtime";
import { createPodAction } from "./actions";
import { PodActions } from "./pod-actions";

export const dynamic = "force-dynamic";

const login = (ok: boolean, label: string) => <span className={`pill ${ok ? "ok" : "fail"}`}>{`${label} ${ok ? "logged in" : "not logged in"}`}</span>;

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
              Create my Pod
            </button>
          </form>
        )}
      </div>

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
              <p className="small faint">
                Pods&apos; limits: {limits.cpus} CPU · {Math.round(limits.memoryMb / 1024)} GB
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

        {!connected && (
          <div className="banner fail" style={{ margin: "0 16px" }}>
            <div className="grow small">
              <b>The Host Agent is not connected.</b> Nothing can start until it is. It reconnects by itself when the Pod Host is back
              online; if it never connected, install it with <span className="mono">scripts/install-host-agent.sh</span>.
            </div>
          </div>
        )}
        {overCommitted && (
          <div className="banner info" style={{ margin: "0 16px" }}>
            <div className="grow small">
              <b>The Pods&apos; limits add up to more than the Pod Host has.</b> Pods still start; they share the machine when busy.
            </div>
          </div>
        )}

        <div className="host-body">
          {pods.length === 0 ? (
            <div className="empty card" style={{ borderStyle: "dashed" }}>
              <b>No Pods yet</b>
              Create your Pod to log in to Claude Code and gh and start Runs.
            </div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Owner</th>
                    <th>Status</th>
                    <th>Image</th>
                    <th>Logins</th>
                    <th>gh account and repositories</th>
                    <th>Slots</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {pods.map((pod) => (
                    <tr key={pod.id} data-testid={pod.mine ? "my-pod" : undefined}>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <Avatar name={pod.owner.name} email={pod.owner.email} picture={pod.owner.pictureUrl} />
                          <span>{pod.owner.name ?? pod.owner.email}</span>
                        </div>
                      </td>
                      <td>
                        <div className="stack" style={{ gap: 4 }}>
                          <StatePill state={pod.status} />
                          {pod.ready && <span className="pill ok">Pod Ready</span>}
                        </div>
                      </td>
                      <td className="mono small">{pod.imageTag.split("/").at(-1)}</td>
                      <td>
                        <div className="stack" style={{ gap: 4 }}>
                          {login(pod.claudeLoggedIn, "Claude Code")}
                          {login(pod.ghLoggedIn, "gh")}
                          <span className="faint small">checked {ago(pod.loginsCheckedAt, now)}</span>
                        </div>
                      </td>
                      <td className="small">
                        <div>{pod.ghAccount ?? <span className="faint">—</span>}</div>
                        <div className="faint">{pod.tokenRepos.length > 0 ? pod.tokenRepos.join(", ") : "no Project reachable"}</div>
                      </td>
                      <td className="num">
                        {pod.inUse} / {pod.slots}
                        <div className="faint small">{pod.queued} queued</div>
                      </td>
                      <td>{pod.mine && <PodActions podId={pod.id} status={pod.status} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
