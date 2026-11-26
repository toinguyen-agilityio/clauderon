"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isEntryKind, type FlowSnapshot } from "@clauderon/core";
import { duration, formatTime, tokens } from "../../../../components/format";
import { useGatewaySocket } from "../../../../components/gateway-socket";
import { HumanForm } from "../../../../components/human-form";
import { OutputValue } from "../../../../components/output-value";
import { MarkdownBody, MarkdownText } from "../../../../components/markdown-text";
import { OType, StatePill } from "../../../../components/state-pill";
import type { viewRun } from "../../../../server/runs";
import { NodeInspector } from "./node-inspector";
import { currentNodeId } from "./run-diagram";
import { RunDiagram } from "./run-flow-diagram";
import { RetryFromHere } from "./retry-run";

type Timeline = Exclude<Awaited<ReturnType<typeof viewRun>>, "not-found">["timeline"];
type TimelineNode = Timeline[number];
type Line = { seq: number; stream: string; text: string };

const KIND: Record<string, [letter: string, label: string]> = {
  ticket: ["T", "Ticket"],
  agent: ["A", "Agent"],
  command: ["$", "Command"],
  approve: ["H", "Human · Approve"],
  grill: ["H", "Human · Grill"],
};

function classify(line: Line): string {
  if (line.stream !== "stdout") return line.stream;
  if (line.text.startsWith("[claude]")) return "a";
  if (line.text.startsWith("[tool]") || line.text.startsWith("[result]")) return "d";
  if (/✓|passed|passing/.test(line.text)) return "k";
  if (/✗|FAIL|Error|failing/.test(line.text)) return "f";
  return "";
}

/**
 * The Node list and the selected Node's live log, Inputs and Outputs (TRK-1,
 * TRK-2, NFR-4). The page refreshes when the Run changes; log lines are
 * backfilled from storage, then streamed.
 */
export function RunLive({
  gatewayUrl,
  runId,
  snapshot,
  timeline,
  runEnded,
  retryable,
  retryContext,
}: {
  gatewayUrl: string;
  runId: string;
  /** The Flow as it was when the Run started, drawn above the Node's details. */
  snapshot: FlowSnapshot;
  timeline: Timeline;
  runEnded: boolean;
  /** Failed or Interrupted: every Node offers Retry from here (spec M3 §4). */
  retryable: boolean;
  /** What a retried Node would be told, before the note. */
  retryContext: string | null;
}) {
  const router = useRouter();
  const socket = useGatewaySocket(gatewayUrl);
  const currentId = currentNodeId(timeline);
  const current = timeline.find((n) => n.id === currentId);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const node = timeline.find((n) => n.id === selectedId) ?? current;
  const [attemptPick, setAttemptPick] = useState<Record<string, string>>({});
  const attempt = node?.attempts.find((a) => a.id === attemptPick[node.id]) ?? node?.attempts[0];

  const [lines, setLines] = useState<Line[]>([]);
  const [follow, setFollow] = useState(true);
  const [view, setView] = useState<"log" | "inspector">("log");
  const logBox = useRef<HTMLPreElement>(null);

  // Run changes refresh the server-rendered page.
  useEffect(() => {
    if (!socket) return;
    const onMessage = (event: MessageEvent) => {
      const message = JSON.parse(String(event.data)) as { type: string };
      if (message.type === "run.changed") router.refresh();
    };
    socket.addEventListener("message", onMessage);
    socket.send(JSON.stringify({ type: "subscribe.run", runId }));
    return () => socket.removeEventListener("message", onMessage);
  }, [socket, runId, router]);

  // One log subscription per socket: the selected Attempt's lines.
  const attemptId = attempt?.id;
  useEffect(() => {
    setLines([]);
    if (!socket || !attemptId) return;
    const onMessage = (event: MessageEvent) => {
      const message = JSON.parse(String(event.data)) as Line & { type: string; attemptId: string };
      if (message.type !== "log" || message.attemptId !== attemptId) return;
      setLines((prev) => (prev.some((l) => l.seq === message.seq) ? prev : [...prev, message].sort((a, b) => a.seq - b.seq)));
    };
    socket.addEventListener("message", onMessage);
    socket.send(JSON.stringify({ type: "subscribe.log", attemptId }));
    return () => {
      socket.removeEventListener("message", onMessage);
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "unsubscribe.log", attemptId }));
    };
  }, [socket, attemptId]);

  useEffect(() => {
    if (follow && logBox.current) logBox.current.scrollTop = logBox.current.scrollHeight;
  }, [lines, follow]);

  if (!node) return null;
  const [letter, kindLabel] = KIND[node.kind] ?? ["?", node.kind];
  const live = attempt?.state === "running";

  return (
    <div className="run-grid">
      <RunDiagram snapshot={snapshot} timeline={timeline} selectedId={node.id} onSelect={setSelectedId} />

      <div className="stack" style={{ minWidth: 0, gap: 16 }}>
        <div>
          <div className="row" style={{ gap: 8 }}>
            <span className={`kind ${node.kind}`} title={kindLabel}>
              {letter}
            </span>
            <h2>{node.name}</h2>
            <StatePill state={attempt ? attempt.state : node.state} />
            {retryable && node.canRetry && (
              <span style={{ marginLeft: "auto" }}>
                <RetryFromHere runId={runId} nodeId={node.id} nodeName={node.name} inputs={node.retryInputs} context={retryContext} />
              </span>
            )}
          </div>
          {node.description && node.kind !== "command" && <MarkdownText text={node.description} />}
          {node.description && node.kind === "command" && (
            <p className="faint small mono" style={{ marginTop: 6, maxWidth: "75ch", whiteSpace: "pre-wrap" }}>
              {node.description}
            </p>
          )}
        </div>

        {node.attempts.length > 1 && (
          <div className="att-tabs" role="tablist" aria-label="Attempts">
            {node.attempts.map((a) => (
              <button key={a.id} type="button" role="tab" aria-selected={a.id === attempt?.id} className={a.id === attempt?.id ? "on" : ""} onClick={() => setAttemptPick({ ...attemptPick, [node.id]: a.id })}>
                #{a.number}
                {a.superseded && <span className="faint"> · earlier pass</span>}
              </button>
            ))}
          </div>
        )}

        {node.openRequest && (
          <div className="card card-pad stack" style={{ gap: 12 }}>
            <span className="eyebrow">{node.openRequest.kind === "grill" ? `Claude asks · round ${node.openRequest.round}` : "Waiting for a decision"}</span>
            {node.openRequest.kind === "approve" && node.openRequest.subject && (
              <div className="stack" style={{ gap: 4 }}>
                <OType type={node.openRequest.subject.type} label={node.openRequest.subject.name} />
                <OutputValue type={node.openRequest.subject.type} value={node.openRequest.subject.value} />
              </div>
            )}
            <HumanForm request={node.openRequest} runId={runId} />
          </div>
        )}

        {!attempt ? (
          <div className="empty card">
            <b>{node.state === "not reached" ? "Not reached" : "Not started"}</b>
            {node.state === "not reached" ? (runEnded ? "The Run ended before this Node." : "An Output it needs was not produced.") : "It runs once the Nodes before it succeed."}
          </div>
        ) : (
          <>
            <dl className="kv small">
              <dt>Started</dt>
              <dd className="num">{formatTime(new Date(attempt.startedAt))}</dd>
              <dt>Duration</dt>
              <dd className="num">{attempt.endedAt ? duration(new Date(attempt.endedAt).getTime() - new Date(attempt.startedAt).getTime()) : "running…"}</dd>
              {(node.kind === "agent" || node.kind === "grill") && (
                <>
                  <dt>Tokens</dt>
                  <dd className="num">{attempt.inputTokens !== null ? `${tokens(attempt.inputTokens)} in · ${tokens(attempt.outputTokens ?? 0)} out` : "counting…"}</dd>
                </>
              )}
              {attempt.error && (
                <>
                  <dt>Failure</dt>
                  <dd style={{ color: "var(--fail)" }}>{attempt.error}</dd>
                </>
              )}
              {attempt.superseded && (
                <>
                  <dt>Pass</dt>
                  <dd className="faint">An earlier pass, replaced by a Retry</dd>
                </>
              )}
            </dl>

            {attempt.retryContext && (
              <details className="stack" style={{ gap: 6 }}>
                <summary className="eyebrow">
                  Retry context
                </summary>
                <MarkdownText text={attempt.retryContext} />
              </details>
            )}

            {attempt.rounds.length > 0 && (
              <div className="stack" style={{ gap: 8 }}>
                <span className="eyebrow">{node.kind === "grill" ? "Rounds" : "Decision"}</span>
                <div className="qa">
                  {attempt.rounds.map((r) => (
                    <Round key={r.id} round={r} />
                  ))}
                </div>
              </div>
            )}

            {!isEntryKind(node.kind) && (
              <div className="seg" role="tablist" aria-label="Node view" style={{ alignSelf: "flex-start" }}>
                <button type="button" role="tab" aria-selected={view === "log"} className={view === "log" ? "on" : ""} onClick={() => setView("log")}>
                  Log
                </button>
                <button type="button" role="tab" aria-selected={view === "inspector"} className={view === "inspector" ? "on" : ""} onClick={() => setView("inspector")}>
                  Inspector
                </button>
              </div>
            )}

            {!isEntryKind(node.kind) &&
              view === "inspector" &&
              (node.kind === "agent" || node.kind === "grill" ? (
                <NodeInspector key={attempt.id} inspector={attempt.inspector} attemptState={attempt.state} />
              ) : (
                <div className="empty card">
                  <b>No Claude session to inspect</b>
                  This Node does not run Claude. Its output is in the Log.
                </div>
              ))}

            {!isEntryKind(node.kind) && view === "log" && (
              <div className="stack" style={{ gap: 8 }}>
                <div className="log-head">
                  <span className="eyebrow">
                    Log {live && <span style={{ color: "var(--run)" }}>· live</span>}
                    {!socket && <span style={{ color: "var(--wait)" }}> · reconnecting</span>}
                  </span>
                  <label className="row small faint" style={{ gap: 6 }}>
                    <input type="checkbox" className="cb" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
                    Follow
                  </label>
                </div>
                <pre className="term" ref={logBox} aria-live="polite" aria-label={`Log of ${node.name}`}>
                  {lines.length === 0 && <span className="d">{live ? "Waiting for output…" : "No log lines."}</span>}
                  {lines.map((l) => (
                    <span key={l.seq} className={classify(l)}>
                      {l.text}
                      {"\n"}
                    </span>
                  ))}
                </pre>
              </div>
            )}

            <div className="grid g2">
              <div className="stack" style={{ gap: 8 }}>
                <span className="eyebrow">Inputs</span>
                {node.inputs.length === 0 && <span className="faint small">None</span>}
                {node.inputs.map((i) => (
                  <div key={i.name} className="stack" style={{ gap: 4 }}>
                    <OType type={i.type} label={i.name} />
                    <OutputValue type={i.type} value={i.value} name={i.name} />
                  </div>
                ))}
              </div>
              <div className="stack" style={{ gap: 8 }}>
                <span className="eyebrow">Outputs</span>
                {attempt.outputs.length === 0 && <span className="faint small">{attempt.state === "running" ? "Not produced yet" : "None"}</span>}
                {attempt.outputs.map((o) => (
                  <div key={o.name} className="stack" style={{ gap: 4 }}>
                    <OType type={o.type} label={o.name} />
                    <OutputValue type={o.type} value={o.value} name={o.name} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type RoundView = TimelineNode["attempts"][number]["rounds"][number];

/** One Grill round or Approve decision, with who answered and when (spec M3 §2.2, §8). */
function Round({ round }: { round: RoundView }) {
  const response = round.response;
  const who = round.respondedBy ? `${round.respondedBy} · ${formatTime(new Date(round.respondedAt!))}` : "";
  return (
    <>
      {round.kind === "grill" &&
        round.questions.map((q) => (
          <div key={q.id} className="stack" style={{ gap: 6 }}>
            <div className="q">
              <span className="who">Claude · round {round.round}</span>
              <MarkdownBody text={q.text} />
            </div>
            {response && "answers" in response && (
              <div className="ans">
                <span className="who">{who}</span>
                <MarkdownBody text={response.answers[q.id] ?? ""} />
              </div>
            )}
          </div>
        ))}
      {response && "cancelled" in response && <span className="small faint">Closed by Cancel{who && ` · ${who}`}</span>}
      {response && "decision" in response && response.decision === "approve" && (
        <div className="ans">
          <span className="who">{who}</span>
          Approved
        </div>
      )}
      {response && "decision" in response && response.decision === "reject" && (
        <div className="ans">
          <span className="who">{who}</span>
          Rejected: {response.feedback}
        </div>
      )}
      {!response && round.kind === "approve" && <span className="small faint">Waiting for Approve or Reject…</span>}
    </>
  );
}
