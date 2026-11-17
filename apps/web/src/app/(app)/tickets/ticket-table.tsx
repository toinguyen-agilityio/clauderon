"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../../../components/icons";
import { StatePill, TicketStatusPill } from "../../../components/state-pill";
import type { TicketRow } from "../../../server/tickets";
import { loadStartDialog, startAction } from "./actions";

type Dialog = Awaited<ReturnType<typeof loadStartDialog>>;

const selectable = (t: TicketRow) => t.activeRunId === null && t.status !== "Closed";

/** The Tickets table with multi-select, the selection bar and the Start dialog (TIC-3, RUN-1). */
export function TicketTable({ rows }: { rows: TicketRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const pickable = rows.filter(selectable);
  const allSelected = pickable.length > 0 && pickable.every((t) => selected.has(t.id));

  // Keep the selection to Tickets still on screen and still selectable.
  useEffect(() => {
    setSelected((s) => new Set([...s].filter((id) => rows.some((t) => t.id === id && selectable(t)))));
  }, [rows]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    className="cb"
                    aria-label="Select all"
                    checked={allSelected}
                    disabled={pickable.length === 0}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(pickable.map((t) => t.id)))}
                  />
                </th>
                <th>Key</th>
                <th>Title</th>
                <th>Status</th>
                <th>Latest Run</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty">
                      <b>No Tickets match</b>
                      Clear the search or pick another status. New issues arrive when you Sync their Project.
                    </div>
                  </td>
                </tr>
              )}
              {rows.map((t) => (
                <tr key={t.id} className={selected.has(t.id) ? "sel" : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      className="cb"
                      aria-label={`Select ${t.key}`}
                      checked={selected.has(t.id)}
                      disabled={!selectable(t)}
                      title={t.activeRunId ? `Has an Active Run (${t.activeRunState?.replaceAll("_", " ")})` : t.status === "Closed" ? "Closed on GitHub" : undefined}
                      onChange={() => toggle(t.id)}
                    />
                  </td>
                  <td className="mono faint" style={{ whiteSpace: "nowrap" }}>
                    {t.key}
                  </td>
                  <td className="t-title">
                    <a href={t.url} target="_blank" rel="noreferrer">
                      {t.title}
                    </a>
                    {t.labels.length > 0 && (
                      <div className="row" style={{ gap: 4, marginTop: 4 }}>
                        {t.labels.map((l) => (
                          <span key={l} className="label">
                            {l}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <TicketStatusPill status={t.status} />
                  </td>
                  <td className="small">
                    {t.latestRun ? (
                      <Link href={`/runs/${t.latestRun.id}`} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                        <StatePill state={t.latestRun.state} />
                        <span className="mono">{t.latestRun.id.slice(0, 8)}</span>
                      </Link>
                    ) : (
                      <span className="faint">No Runs yet</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="selbar" role="region" aria-label="Selection">
          <span>
            <b>{selected.size}</b> Ticket{selected.size > 1 ? "s" : ""} selected
          </span>
          <div className="row">
            <button type="button" className="btn ghost sm" onClick={() => setSelected(new Set())}>
              Clear
            </button>
            <button type="button" className="btn primary" onClick={() => setDialogOpen(true)}>
              {Icon.play}
              Start Runs…
            </button>
          </div>
        </div>
      )}

      {dialogOpen && (
        <StartDialog
          ticketIds={[...selected]}
          onClose={() => setDialogOpen(false)}
          onStarted={() => {
            setDialogOpen(false);
            setSelected(new Set());
          }}
        />
      )}
    </>
  );
}

const TRUST_HINT = "opened by someone outside the repository";

function StartDialog({ ticketIds: initial, onClose, onStarted }: { ticketIds: string[]; onClose: () => void; onStarted: () => void }) {
  // The selection is fixed while the dialog is open.
  const [ticketIds] = useState(initial);
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [flowId, setFlowId] = useState("");
  const [extra, setExtra] = useState("");
  const [mode, setMode] = useState<"real" | "dry">("real");
  const [error, setError] = useState<{ text: string; terminal?: string } | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal();
    void loadStartDialog(ticketIds).then((loaded) => {
      setDialog(loaded);
      setFlowId(loaded.flows.find((f) => !f.needsHuman)?.id ?? "");
    });
  }, [ticketIds]);

  const start = async () => {
    setPending(true);
    setError(null);
    const result = await startAction({ flowId, ticketIds, extraInstructions: extra, mode });
    setPending(false);
    if (!result.ok) {
      setError({ text: result.error, terminal: result.terminal });
      return;
    }
    onStarted();
    router.push(result.runIds.length === 1 ? `/runs/${result.runIds[0]}` : "/runs");
  };

  const pod = dialog?.pod;
  const warned = new Map(dialog?.warnings.map((w) => [w.ticketId, w.authorAssociation]));
  return (
    <dialog ref={ref} className="modal wide" aria-labelledby="sd-title" onClose={onClose}>
      <div className="modal-in">
        <div className="modal-h">
          <div>
            <h2 id="sd-title">Start Runs</h2>
            <p className="muted small" style={{ marginTop: 4 }}>
              One Run per Ticket, grouped as a Batch on your Pod.
            </p>
          </div>
          <button type="button" className="btn ghost sm" aria-label="Close" onClick={() => ref.current?.close()}>
            {Icon.x}
          </button>
        </div>

        {!dialog ? (
          <div className="modal-b">
            <span className="faint small">Loading…</span>
          </div>
        ) : (
          <div className="modal-b">
            <div className="field">
              <label>Flow</label>
              <div className="grid g2" role="radiogroup" aria-label="Flow">
                {dialog.flows.map((f) => (
                  <label key={f.id} className={`opt-card ${flowId === f.id ? "on" : ""} ${f.needsHuman ? "dis" : ""}`}>
                    <input type="radio" name="flow" checked={flowId === f.id} disabled={f.needsHuman} onChange={() => setFlowId(f.id)} />
                    <div className="grow">
                      <b>{f.name}</b>
                      <div className="faint small">
                        {f.nodes} Nodes{f.needsHuman ? " · has Human Nodes, which arrive in M3" : ""}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Pod</label>
              {!pod ? (
                <div className="banner fail">
                  <div className="grow small">
                    <b>You have no Pod yet.</b> Runs always run on the Starter&apos;s Pod.
                  </div>
                  <Link className="btn sm primary" href="/pods">
                    Create my Pod
                  </Link>
                </div>
              ) : mode === "real" && !pod.ready && pod.status === "running" ? (
                <div className="banner fail">
                  <div className="grow small">
                    <b>Your Pod is not logged in to Claude Code and gh.</b> Open its terminal and log in with your own accounts.
                  </div>
                  <Link className="btn sm" href={`/pods/${pod.id}/terminal`}>
                    Open terminal
                  </Link>
                </div>
              ) : (
                <div className="opt-card on" style={{ cursor: "default" }}>
                  {Icon.cube}
                  <div className="grow">
                    <b>My Pod</b> <span className="faint small">· {pod.status}</span>
                    <div className="faint small num">
                      {pod.inUse}/{pod.slots} Slots busy · {pod.queued} queued
                    </div>
                  </div>
                </div>
              )}
              {pod && pod.status !== "running" && <span className="hint">Your Pod is {pod.status}. Runs wait in its queue until it runs again.</span>}
              {pod && dialog && (
                <span className="hint" data-testid="queue-hint">
                  {(() => {
                    const now = dialog.positions.filter((p) => p === 0).length;
                    const waiting = dialog.positions.length - now;
                    if (waiting === 0) return `${now} of these start${now === 1 ? "s" : ""} at once.`;
                    return `${now === 0 ? "None start at once" : `${now} start at once`}; ${waiting} wait${waiting === 1 ? "s" : ""} for a Slot, first in, first out (queue position${waiting === 1 ? "" : "s"} 1${waiting > 1 ? `–${waiting}` : ""}).`;
                  })()}
                </span>
              )}
            </div>

            <div className="field">
              <label>Mode</label>
              <div className="seg" style={{ width: "fit-content" }}>
                <button type="button" className={mode === "real" ? "on" : undefined} aria-pressed={mode === "real"} onClick={() => setMode("real")}>
                  Real
                </button>
                <button type="button" className={mode === "dry" ? "on" : undefined} aria-pressed={mode === "dry"} onClick={() => setMode("dry")}>
                  Dry-run
                </button>
              </div>
              <span className="hint">
                {mode === "real"
                  ? "Claude Code runs on your Pod and a real pull request is opened under your gh account."
                  : "Simulated Nodes with fake Outputs. It takes a Slot but never calls Claude or GitHub, and needs no logins."}
              </span>
            </div>

            <div className="field">
              <label htmlFor="sd-extra">
                Extra instructions <span className="faint">(optional)</span>
              </label>
              <textarea
                id="sd-extra"
                className="textarea"
                placeholder="e.g. Keep the public API unchanged."
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
              />
              <span className="hint">Added to every Agent Node of these Runs.</span>
            </div>

            <div className="field">
              <label>
                Tickets <span className="faint num">{dialog.tickets.length}</span>
              </label>
              <div className="pick">
                {dialog.tickets.map((t) => (
                  <div key={t.id}>
                    <span className="mono faint small">{t.key}</span>
                    <span className="grow">{t.title}</span>
                    {warned.has(t.id) && (
                      <span className="pill wait plain" title={`${TRUST_HINT} (${warned.get(t.id)})`}>
                        Outside author
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {warned.size > 0 && <span className="hint">Tickets marked Outside author were {TRUST_HINT}. Read them before you run them.</span>}
            </div>

            {error && (
              <div className="banner fail" role="alert">
                <div className="grow small">{error.text}</div>
                {error.terminal && (
                  <Link className="btn sm" href={error.terminal}>
                    Open terminal
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        <div className="modal-f">
          <button type="button" className="btn" onClick={() => ref.current?.close()}>
            Cancel
          </button>
          <button type="button" className="btn primary" disabled={!dialog || pending || !flowId || !pod} onClick={() => void start()}>
            {Icon.play}
            {pending ? "Starting…" : `Start ${ticketIds.length} Run${ticketIds.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </dialog>
  );
}
