"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "../../../components/brand";
import { Icon } from "../../../components/icons";
import { StartRunsDialog } from "../../../components/start-runs-dialog";
import type { PullRequestRow } from "../../../server/runs";
import { loadPullRequestStartDialog, startPullRequestsAction } from "./actions";

/** A row as it crosses to the client: its time already written out. */
export type PullRequestListRow = Omit<PullRequestRow, "at"> & { ago: string };

// Only a pull request read from GitHub now: a row kept from a Run while GitHub could not be read may be closed.
const selectable = (r: PullRequestListRow) => r.title !== null;

/** The open pull requests with multi-select, the selection bar and the Start dialog. */
export function PullRequestTable({ rows, empty }: { rows: PullRequestListRow[]; empty: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const pickable = rows.filter(selectable);
  const allSelected = pickable.length > 0 && pickable.every((r) => selected.has(r.id));

  // Keep the selection to pull requests still on screen.
  useEffect(() => {
    setSelected((s) => new Set([...s].filter((id) => rows.some((r) => r.id === id && selectable(r)))));
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
                  onChange={() => setSelected(allSelected ? new Set() : new Set(pickable.map((r) => r.id)))}
                />
              </th>
              <th>Pull request</th>
              <th>Ticket</th>
              <th>Flow</th>
              <th>Opened by</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="empty">
                    <b>No pull requests</b>
                    {empty}
                  </div>
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className={selected.has(r.id) ? "sel" : undefined}>
                <td>
                  <input
                    type="checkbox"
                    className="cb"
                    aria-label={`Select ${r.repo}#${r.number}`}
                    checked={selected.has(r.id)}
                    disabled={!selectable(r)}
                    title={selectable(r) ? undefined : "Could not read it from GitHub just now"}
                    onChange={() => toggle(r.id)}
                  />
                </td>
                <td className="t-title">
                  <span className="mono faint small">
                    {r.repo}{" "}
                    {r.url ? (
                      <a className="mono" href={r.url} target="_blank" rel="noreferrer">
                        #{r.number} {Icon.external}
                      </a>
                    ) : (
                      <span className="mono">#{r.number}</span>
                    )}
                  </span>
                  {r.title && <div>{r.title}</div>}
                  {r.needsYou && <span className="pill wait">Needs you</span>}
                  {r.branch && <div className="mono faint small clip pr-branch">{r.branch}</div>}
                </td>
                <td className="t-title">
                  {r.run ? (
                    <>
                      <span className="mono faint small">{r.run.key}</span>
                      <div>
                        <Link href={`/runs/${r.run.id}`}>{r.run.ticketTitle}</Link>
                      </div>
                    </>
                  ) : (
                    <span className="faint small">Not opened by a Run</span>
                  )}
                </td>
                <td className="small nowrap">{r.run?.flowName ?? <span className="faint">—</span>}</td>
                <td>
                  {r.run ? (
                    <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                      <Avatar name={r.run.starterName} email={r.run.starterEmail} picture={r.run.starterPicture} />
                      <span className="small nowrap">
                        {r.run.starterName ?? r.run.starterEmail}
                        <div className="faint">{r.ago}</div>
                      </span>
                    </div>
                  ) : (
                    <span className="small nowrap">
                      <span className="mono">@{r.authorLogin}</span>
                      <div className="faint">{r.ago}</div>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected.size > 0 && (
        <div className="selbar" role="region" aria-label="Selection">
          <span>
            <b>{selected.size}</b> pull request{selected.size > 1 ? "s" : ""} selected
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
          rows={rows.filter((r) => selected.has(r.id))}
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

function StartDialog({ rows: initial, onClose, onStarted }: { rows: PullRequestListRow[]; onClose: () => void; onStarted: () => void }) {
  // The selection is fixed while the dialog is open.
  const [rows] = useState(initial);
  return (
    <StartRunsDialog
      count={rows.length}
      noun="pull request"
      subtitle="One Run per pull request, grouped as a Batch on your Machine."
      noFlows={
        <>
          <b>No Flow starts from a pull request yet.</b> Make one with a Pull request Input on the <Link href="/flows">Flows</Link> page.
        </>
      }
      load={async () => ({
        ...(await loadPullRequestStartDialog(rows.length)),
        items: rows.map((r) => ({ id: r.id, key: `${r.repo}#${r.number}`, title: r.title ?? "" })),
      })}
      start={(flowId, extraInstructions) =>
        startPullRequestsAction({ flowId, extraInstructions, pullRequests: rows.map((r) => ({ projectId: r.projectId, number: r.number })) })
      }
      onClose={onClose}
      onStarted={onStarted}
    />
  );
}
