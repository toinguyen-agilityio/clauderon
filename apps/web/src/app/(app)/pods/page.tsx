import { getPodHost } from "@clauderon/db";
import { Icon } from "../../../components/icons";
import { deps } from "../../../server/runtime";

export const dynamic = "force-dynamic";

function ago(date: Date | null, now: Date): string {
  if (!date) return "never";
  const seconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86400)} d ago`;
}

export default async function PodsPage() {
  const host = await getPodHost(deps().db);
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

        <div className="host-body">
          <div className="empty card" style={{ borderStyle: "dashed" }}>
            <b>No Pods yet</b>
            Creating your own Pod arrives with the walking skeleton (M1).
          </div>
        </div>
      </div>
    </>
  );
}
