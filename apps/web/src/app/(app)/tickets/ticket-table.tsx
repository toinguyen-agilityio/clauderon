"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "../../../components/icons";
import { StatePill, TicketStatusPill } from "../../../components/state-pill";
import type { TicketRow } from "../../../server/tickets";
import { loadStartDialog, startAction } from "./actions";
import { StartRunsDialog } from "../../../components/start-runs-dialog";

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
  return (
    <StartRunsDialog
      count={ticketIds.length}
      noun="Ticket"
      subtitle="One Run per Ticket, grouped as a Batch on your Machine."
      noFlows="No Flow starts from a Ticket without problems."
      load={async () => {
        const d = await loadStartDialog(ticketIds);
        const warned = new Map(d.warnings.map((w) => [w.ticketId, w.authorAssociation]));
        return {
          flows: d.flows,
          machine: d.machine,
          positions: d.positions,
          items: d.tickets.map((t) => ({
            ...t,
            warning: warned.has(t.id) ? { label: "Outside author", title: `${TRUST_HINT} (${warned.get(t.id)})` } : undefined,
          })),
          warningHint: `Tickets marked Outside author were ${TRUST_HINT}. Read them before you run them.`,
        };
      }}
      start={(flowId, extraInstructions) => startAction({ flowId, ticketIds, extraInstructions })}
      onClose={onClose}
      onStarted={onStarted}
    />
  );
}
