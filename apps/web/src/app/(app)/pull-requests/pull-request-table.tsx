"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "../../../components/brand";
import { Icon } from "../../../components/icons";
import { SortHeader } from "../../../components/sort-header";
import { tagColor } from "../../../components/state-pill";
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
        <table className="tbl tk-table">
          <thead>
            <tr>
              <th className="tk-cb">
                <input
                  type="checkbox"
                  className="cb"
                  aria-label="Select all"
                  checked={allSelected}
                  disabled={pickable.length === 0}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(pickable.map((r) => r.id)))}
                />
              </th>
              <SortHeader className="tk-stub" column="pr" label="Pull request" />
              <SortHeader column="title" label="Title" />
              <SortHeader column="from" label="Opened from" />
              <SortHeader column="by" label="Opened by" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="empty tk-empty">
                    <b>No pull requests</b>
                    {empty}
                  </div>
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const tone = !selectable(r) ? "mute" : r.needsYou ? "wait" : "ok";
              return (
                <tr key={r.id} className={`tk-row tone-${tone}${selected.has(r.id) ? " sel" : ""}`}>
                  <td className="tk-cb">
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
                  <td className="tk-stub">
                    <span className="tk-num">#{r.number}</span>
                    <span className="tk-repo" style={{ "--c": tagColor(r.repo) } as React.CSSProperties}>
                      {r.repo}
                    </span>
                  </td>
                  <td className="t-title">
                    {r.url ? (
                      <a className="tk-ext" href={r.url} target="_blank" rel="noreferrer">
                        {r.title ?? `Pull request #${r.number}`} {Icon.external}
                      </a>
                    ) : (
                      <span>{r.title ?? `Pull request #${r.number}`}</span>
                    )}
                    {(r.branch || r.needsYou || !selectable(r)) && (
                      <div className="tk-meta">
                        {r.needsYou && <span className="pill wait">Needs your review</span>}
                        {r.branch && <span className="tk-branch clip">{r.branch}</span>}
                        {!selectable(r) && <span className="faint">Could not read it from GitHub just now</span>}
                      </div>
                    )}
                  </td>
                  <td className="t-title">
                    {r.run ? (
                      <>
                        <Link href={`/runs/${r.run.id}`}>{r.run.ticketTitle}</Link>
                        <div className="tk-meta">
                          <span className="tk-flow">{r.run.flowName}</span>
                          <span className="faint">{r.run.key}</span>
                        </div>
                      </>
                    ) : (
                      <span className="faint small">Not opened by a Run</span>
                    )}
                  </td>
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
              );
            })}
          </tbody>
        </table>
      </div>

      {selected.size > 0 && (
        <div className="selbar" role="region" aria-label="Selection">
          <span className="tk-selcount">
            <b className="num">{selected.size}</b> pull request{selected.size > 1 ? "s" : ""} selected
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
