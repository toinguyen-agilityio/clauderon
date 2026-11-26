"use client";

import { useState } from "react";
import { formatTime, tokens } from "../../../../components/format";
import type { viewRun } from "../../../../server/runs";

type Attempt = Exclude<Awaited<ReturnType<typeof viewRun>>, "not-found">["timeline"][number]["attempts"][number];
export type Inspected = Attempt["inspector"];

const SEGMENTS = [
  ["newInput", "New input", "var(--run)"],
  ["cacheCreated", "Cache created", "var(--saffron)"],
  ["cacheRead", "Cache read", "var(--mute)"],
  ["output", "Output", "var(--ok)"],
] as const;

/** A turn's row label: its first call, and how many others it made at the same time. */
function callLabel(calls: { tool: string; target: string | null }[]): string {
  const [first] = calls;
  if (!first) return "Answered";
  return `${first.tool}${first.target ? ` ${first.target}` : ""}${calls.length > 1 ? ` +${calls.length - 1} more` : ""}`;
}

const bytes = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)} KB` : `${n} B`);

/**
 * The Node inspector (#105): what an Agent or Grill Node did turn by turn and where its
 * tokens went, viewed after it finishes. Nothing here is applied by itself.
 */
export function NodeInspector({ inspector, attemptState }: { inspector: Inspected; attemptState: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const { summary, turns, findings, suggestions, history } = inspector;

  if (!inspector.hasTurns && (attemptState === "running" || attemptState === "waiting_for_human")) {
    return (
      <div className="empty card">
        <b>Available when this Node finishes</b>
        Turns and tokens are reported once Claude has finished, not while it runs.
      </div>
    );
  }

  if (!inspector.hasTurns) {
    const t = inspector.totalsOnly;
    return (
      <div className="empty card">
        <b>No turn-by-turn data</b>
        {t
          ? `This Attempt only has totals: ${tokens(t.input)} in · ${tokens(t.output)} out. Update the Machine's Agent to see its turns.`
          : "This Attempt did not report any tokens."}
      </div>
    );
  }

  const widest = Math.max(1, ...turns.map((t) => t.newInput + t.cacheCreated + t.cacheRead + t.output));
  const turn = turns.find((t) => t.index === picked) ?? null;
  const flagged = new Set(findings.flatMap((f) => f.turns));
  const highlighted = new Set((findings.find((f) => f.turns.includes(picked ?? -1)) ?? { turns: [] }).turns);

  const copy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(id);
  };

  return (
    <div className="stack" style={{ gap: 18 }} data-testid="inspector">
      <div className="stats">
        <Stat label="Total tokens" value={tokens(summary.total)} sub="fresh + output, cache read not counted" />
        <Stat label="Fresh" value={tokens(summary.fresh)} sub="new input + cache created" />
        <Stat label="Output" value={tokens(summary.output)} />
        <Stat label="Turns" value={String(summary.turns)} sub={`${summary.toolCalls} tool calls`} />
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <span className="eyebrow">Turns</span>
        <div className="legend small faint">
          {SEGMENTS.map(([key, label, color]) => (
            <span key={key} className="row" style={{ gap: 4 }}>
              <i className="swatch" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>
        <ol className="turns" aria-label="Turns">
          {turns.map((t) => (
            <li key={t.index}>
              <button type="button" className={`turn ${picked === t.index ? "on" : ""} ${highlighted.has(t.index) ? "hl" : ""}`} aria-pressed={picked === t.index} onClick={() => setPicked(picked === t.index ? null : t.index)}>
                <span className="num faint">{t.index + 1}</span>
                <span className="what mono">
                  {callLabel(t.calls)}
                  {flagged.has(t.index) && <span className="flag" title="Flagged below"> ●</span>}
                </span>
                <span className="bar" aria-hidden="true">
                  {SEGMENTS.map(([key, , color]) => (
                    <i key={key} style={{ width: `${(t[key] / widest) * 100}%`, background: color }} />
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ol>
        {turn && (
          <dl className="kv small card card-pad" data-testid="turn-detail">
            <dt>Tokens</dt>
            <dd className="num">
              {tokens(turn.newInput)} new · {tokens(turn.cacheCreated)} cache created · {tokens(turn.cacheRead)} cache read · {tokens(turn.output)} out
            </dd>
            <dt>Context at start</dt>
            <dd className="num">{tokens(turn.context)}</dd>
            <dt>Tool calls</dt>
            <dd>
              {turn.calls.length === 0 && <span className="faint">none</span>}
              {turn.calls.map((c, i) => (
                <div key={i} className="mono small">
                  {c.tool}
                  {c.target ? ` ${c.target}` : ""}
                  <span className="faint"> · {c.resultBytes === null ? "no result" : bytes(c.resultBytes)}</span>
                </div>
              ))}
            </dd>
            <dt>Tool results</dt>
            <dd className="num">{turn.resultBytes === null ? "none" : bytes(turn.resultBytes)}</dd>
            <dt>Re-read by</dt>
            <dd className="num">{turn.resultBytes === null ? "—" : `${turn.rereads} later ${turn.rereads === 1 ? "turn" : "turns"}`}</dd>
          </dl>
        )}
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <span className="eyebrow">Where tokens were wasted</span>
        {findings.length === 0 && <span className="faint small">Nothing stands out in this Attempt.</span>}
        {findings.map((f) => (
          <button key={`${f.kind}:${f.title}`} type="button" className="card card-pad finding" onClick={() => setPicked(f.turns[0] ?? null)}>
            <b>{f.title}</b>
            <span className="faint small">
              about {tokens(f.tokens)} tokens · turn {f.turns.map((i) => i + 1).join(", ")}
            </span>
          </button>
        ))}
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <span className="eyebrow">Teach the AI</span>
        {suggestions.length === 0 && <span className="faint small">No suggestions for this Attempt.</span>}
        {suggestions.map((s) => (
          <div key={s.id} className="card card-pad stack" style={{ gap: 6 }}>
            <span className="small faint">
              Add to {s.target === "node" ? "this Node's instructions" : "the project rule (CLAUDE.md)"} · could save about {tokens(s.tokens)} tokens
            </span>
            <p style={{ margin: 0 }}>{s.text}</p>
            <div>
              <button type="button" className="btn sm" onClick={() => void copy(s.id, s.text)}>
                {copied === s.id ? "Copied" : "Copy wording"}
              </button>
            </div>
          </div>
        ))}
        <span className="faint small">Nothing is applied automatically.</span>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <span className="eyebrow">This Node in earlier Runs</span>
        {history.length === 0 ? (
          <span className="faint small">No earlier Runs of this Node with turns.</span>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Run</th>
                <th>When</th>
                <th className="num">Turns</th>
                <th className="num">Fresh</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.runId}>
                  <td>
                    <a href={`/runs/${h.runId}`} className="mono">
                      {h.runId.slice(0, 8)}
                    </a>
                  </td>
                  <td className="faint">{formatTime(new Date(h.at))}</td>
                  <td className="num">{h.turns}</td>
                  <td className="num">{tokens(h.fresh)}</td>
                  <td className="num">{tokens(h.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card stat">
      <span className="eyebrow">{label}</span>
      <span className="v">{value}</span>
      {sub && <span className="faint small">{sub}</span>}
    </div>
  );
}
