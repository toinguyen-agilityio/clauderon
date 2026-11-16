"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { duration } from "../../../../components/format";
import { openGatewaySocket } from "../../../../components/gateway-socket";
import { StatePill } from "../../../../components/state-pill";
import type { viewRun } from "../../../../server/runs";

type Timeline = Exclude<Awaited<ReturnType<typeof viewRun>>, "not-found">["timeline"];
type Line = { seq: number; stream: string; text: string };

/**
 * The Node timeline with the selected Node's live log and Outputs (TRK-1,
 * TRK-2, NFR-4). The page refreshes when the Run changes; log lines are
 * backfilled from storage, then streamed.
 */
export function RunLive({ gatewayUrl, runId, timeline }: { gatewayUrl: string; runId: string; timeline: Timeline }) {
  const router = useRouter();
  const current = timeline.find((n) => n.state === "running") ?? [...timeline].reverse().find((n) => n.attempts.length > 0) ?? timeline[0];
  const [selectedId, setSelectedId] = useState(current?.id);
  const node = timeline.find((n) => n.id === selectedId) ?? current;
  const attempt = node?.attempts.at(-1);

  const socket = useRef<WebSocket | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [follow, setFollow] = useState(true);
  const logBox = useRef<HTMLPreElement>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let closed = false;
    void openGatewaySocket(gatewayUrl, "/browser").then((ws) => {
      if (!ws || closed) return ws?.close();
      socket.current = ws;
      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ type: "subscribe.run", runId }));
      };
      ws.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as { type: string; attemptId?: string } & Line;
        if (message.type === "run.changed") router.refresh();
        if (message.type === "log") {
          window.dispatchEvent(new CustomEvent("clauderon-log", { detail: message }));
        }
      };
      ws.onclose = (event) => {
        setConnected(false);
        if (event.code === 4403) window.location.href = "/session-ended";
      };
    });
    return () => {
      closed = true;
      socket.current?.close();
      socket.current = null;
    };
  }, [gatewayUrl, runId, router]);

  // One log subscription: the selected Node's latest Attempt.
  const attemptId = attempt?.id;
  useEffect(() => {
    setLines([]);
    if (!attemptId || !connected) return;
    const ws = socket.current;
    ws?.send(JSON.stringify({ type: "subscribe.log", attemptId }));
    const onLog = (event: Event) => {
      const line = (event as CustomEvent<Line & { attemptId: string }>).detail;
      if (line.attemptId !== attemptId) return;
      setLines((prev) => (prev.some((l) => l.seq === line.seq) ? prev : [...prev, line].sort((a, b) => a.seq - b.seq)));
    };
    window.addEventListener("clauderon-log", onLog);
    return () => {
      window.removeEventListener("clauderon-log", onLog);
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "unsubscribe.log", attemptId }));
    };
  }, [attemptId, connected]);

  useEffect(() => {
    if (follow && logBox.current) logBox.current.scrollTop = logBox.current.scrollHeight;
  }, [lines, follow]);

  return (
    <div className="run-grid">
      <div className="card">
        <ol className="timeline" aria-label="Nodes">
          {timeline.map((n) => (
            <li key={n.id}>
              <button type="button" aria-current={n.id === node?.id} onClick={() => setSelectedId(n.id)}>
                <span>
                  {n.name}
                  <span className="faint small"> {duration(n.durationMs)}</span>
                  {n.attempts.length > 1 && <span className="faint small"> · {n.attempts.length} Attempts</span>}
                </span>
                <StatePill state={n.state} />
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="stack" style={{ gap: 16 }}>
        <div className="card">
          <div className="card-head">
            <h2>
              {node?.name ?? "Node"} <span className="faint small">· log{attempt ? ` of Attempt ${attempt.number}` : ""}</span>
            </h2>
            <label className="row small">
              <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Auto-scroll
            </label>
          </div>
          <div className="card-pad">
            {attempt?.error && <p className="err-text small">{attempt.error}</p>}
            <pre className="log" ref={logBox} aria-live="polite">
              {!attempt && <span className="system">Not started yet.</span>}
              {attempt && lines.length === 0 && <span className="system">{node?.kind === "ticket" ? "The Ticket Node is not executed." : "No log lines yet."}</span>}
              {lines.map((l) => (
                <span key={l.seq} className={l.stream}>
                  {l.text}
                  {"\n"}
                </span>
              ))}
            </pre>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Outputs</h2>
          </div>
          <div className="card-pad stack" style={{ gap: 12 }}>
            {node?.attempts.length === 0 && <span className="faint small">No Attempt yet.</span>}
            {node?.attempts.map((a) => (
              <div key={a.id} className="stack" style={{ gap: 6 }}>
                <div className="row small">
                  <b>Attempt {a.number}</b> <StatePill state={a.state} />
                  {a.inputTokens !== null && (
                    <span className="faint">
                      {a.inputTokens} in · {a.outputTokens} out tokens
                    </span>
                  )}
                </div>
                {a.outputs.length === 0 && <span className="faint small">No Outputs.</span>}
                {a.outputs.map((o) => (
                  <div key={o.name}>
                    <span className="tag">{o.name}</span>
                    <pre className="output-value">{typeof o.value === "string" ? o.value : JSON.stringify(o.value, null, 2)}</pre>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
