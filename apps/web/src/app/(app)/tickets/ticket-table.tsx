"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { StatePill } from "../../../components/state-pill";
import type { TicketRow } from "../../../server/tickets";
import { loadStartDialog, startAction } from "./actions";

type Dialog = Awaited<ReturnType<typeof loadStartDialog>>;

/** The Tickets table with multi-select and the Start dialog (TIC-3, RUN-1). */
export function TicketTable({ rows }: { rows: TicketRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <div className="row between" style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>
        <span className="faint small">{selected.size > 0 ? `${selected.size} selected` : "Select Tickets to start Runs"}</span>
        <StartButton ticketIds={[...selected]} onStarted={() => setSelected(new Set())} />
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th aria-label="Select" />
              <th>Key</th>
              <th>Title</th>
              <th>Labels</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="faint">
                  No Tickets match. Enable a Project and press Sync to pull its issues.
                </td>
              </tr>
            )}
            {rows.map((t) => (
              <tr key={t.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${t.key}`}
                    checked={selected.has(t.id)}
                    disabled={t.activeRunId !== null || t.status === "Closed"}
                    title={t.activeRunId ? `Has an Active Run (${t.activeRunState}): /runs/${t.activeRunId}` : undefined}
                    onChange={() => toggle(t.id)}
                  />
                </td>
                <td className="mono">
                  <a href={t.url} target="_blank" rel="noreferrer">
                    {t.key}
                  </a>
                </td>
                <td>{t.title}</td>
                <td>
                  <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                    {t.labels.map((l) => (
                      <span key={l} className="tag">
                        {l}
                      </span>
                    ))}
                  </div>
                </td>
                <td>{t.activeRunId ? <Link href={`/runs/${t.activeRunId}`}><StatePill state={t.status} /></Link> : <StatePill state={t.status} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StartButton({ ticketIds, onStarted }: { ticketIds: string[]; onStarted: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [flowId, setFlowId] = useState("");
  const [extra, setExtra] = useState("");
  const [error, setError] = useState<{ text: string; terminal?: string } | null>(null);
  const [pending, setPending] = useState(false);

  const open = async () => {
    setError(null);
    const loaded = await loadStartDialog(ticketIds);
    setDialog(loaded);
    setFlowId(loaded.flows.find((f) => f.name === "Basic ticket delivery")?.id ?? loaded.flows[0]?.id ?? "");
    ref.current?.showModal();
  };

  const start = async () => {
    setPending(true);
    const result = await startAction({ flowId, ticketIds, extraInstructions: extra });
    setPending(false);
    if (!result.ok) {
      setError({ text: result.error, terminal: result.terminal });
      return;
    }
    ref.current?.close();
    onStarted();
    router.push(result.runIds.length === 1 ? `/runs/${result.runIds[0]}` : "/runs");
  };

  const pod = dialog?.pod;
  return (
    <>
      <button type="button" className="btn primary" disabled={ticketIds.length === 0} onClick={() => void open()}>
        Start
      </button>
      <dialog ref={ref} className="dialog" aria-label="Start Runs">
        {dialog && (
          <>
            <div className="dialog-body">
              <h2>Start {dialog.tickets.length === 1 ? "a Run" : `${dialog.tickets.length} Runs`}</h2>
              <label className="field">
                <span className="small faint">Flow</span>
                <select className="input" value={flowId} onChange={(e) => setFlowId(e.target.value)}>
                  {dialog.flows.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field">
                <span className="small faint">Mode</span>
                <span className="pill acc">Real</span>
              </div>
              <label className="field">
                <span className="small faint">Extra instructions</span>
                <textarea className="input" rows={3} value={extra} onChange={(e) => setExtra(e.target.value)} />
              </label>
              <div className="small">
                <b>Tickets:</b> {dialog.tickets.map((t) => t.key).join(", ")}
              </div>
              {dialog.warnings.map((w) => (
                <div key={w.ticketId} className="banner info small">
                  {w.key} was opened by someone outside the repository ({w.authorAssociation}). Check it before you run it.
                </div>
              ))}
              <div className="small">
                {pod ? (
                  <>
                    Your Pod: <b>{pod.status}</b> · {pod.inUse} / {pod.slots} Slots in use · {pod.queued} queued ·{" "}
                    {pod.ready ? <span className="pill ok">Pod Ready</span> : <span className="pill fail">Not Pod Ready</span>}
                  </>
                ) : (
                  <span className="err-text">You have no Pod yet. Create it on the Pods page.</span>
                )}
              </div>
              {error && (
                <div className="err-text small">
                  {error.text}{" "}
                  {error.terminal && (
                    <Link href={error.terminal} className="btn link">
                      Open the terminal
                    </Link>
                  )}
                </div>
              )}
            </div>
            <div className="dialog-foot">
              <button type="button" className="btn" onClick={() => ref.current?.close()}>
                Cancel
              </button>
              <button type="button" className="btn primary" disabled={pending || !flowId} onClick={() => void start()}>
                Start
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
