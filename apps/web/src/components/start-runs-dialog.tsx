"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { pullRequestStartDialog, StartResult } from "../server/start";
import { closeOnBackdrop } from "./dialog";
import { Icon } from "./icons";

type Machine = Awaited<ReturnType<typeof pullRequestStartDialog>>["machine"];

/** What the dialog shows; each source (Tickets, pull requests) maps its own data onto it. */
export type StartRunsData = {
  flows: { id: string; name: string; nodes: number; needsHuman: boolean }[];
  machine: Machine;
  positions: number[];
  items: { id: string; key: string; title: string; warning?: { label: string; title: string } }[];
  /** Explains the items' warnings, when any has one. */
  warningHint?: string;
};

/**
 * The Start dialog (RUN-1): pick a Flow, see the Starter's Machine and its queue, add extra
 * instructions, then start one Run per picked item as one Batch.
 */
export function StartRunsDialog({
  count,
  noun,
  subtitle,
  noFlows,
  load,
  start,
  onClose,
  onStarted,
}: {
  count: number;
  /** Singular, as in "1 Ticket". */
  noun: string;
  subtitle: string;
  /** Shown when no Flow can start from these items. */
  noFlows: React.ReactNode;
  load: () => Promise<StartRunsData>;
  start: (flowId: string, extraInstructions: string) => Promise<StartResult>;
  onClose: () => void;
  onStarted: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [dialog, setDialog] = useState<StartRunsData | null>(null);
  const [flowId, setFlowId] = useState("");
  const [extra, setExtra] = useState("");
  const [error, setError] = useState<{ text: string; machinePage?: string } | null>(null);
  const [pending, setPending] = useState(false);
  // Loaded once: the selection is fixed while the dialog is open.
  const loader = useRef(load);

  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal();
    void loader.current().then((loaded) => {
      setDialog(loaded);
      setFlowId(loaded.flows[0]?.id ?? "");
    });
  }, []);

  const go = async () => {
    setPending(true);
    setError(null);
    const result = await start(flowId, extra);
    setPending(false);
    if (!result.ok) {
      setError({ text: result.error, machinePage: result.machinePage });
      return;
    }
    onStarted();
    router.push(result.runIds.length === 1 ? `/runs/${result.runIds[0]}` : "/runs");
  };

  const machine = dialog?.machine;
  const plural = (n: number) => `${noun}${n === 1 ? "" : "s"}`;
  return (
    <dialog ref={ref} {...closeOnBackdrop} className="modal wide" aria-labelledby="sd-title" onClose={onClose}>
      <div className="modal-in">
        <div className="modal-h">
          <div>
            <h2 id="sd-title">Start Runs</h2>
            <p className="muted small" style={{ marginTop: 4 }}>
              {subtitle}
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
              {dialog.flows.length === 0 ? (
                <div className="banner wait" data-testid="no-flows">
                  <div className="grow small">{noFlows}</div>
                </div>
              ) : (
                <div className="grid g2" role="radiogroup" aria-label="Flow">
                  {dialog.flows.map((f) => (
                    <label key={f.id} className={`opt-card ${flowId === f.id ? "on" : ""}`}>
                      <input type="radio" name="flow" checked={flowId === f.id} onChange={() => setFlowId(f.id)} />
                      <div className="grow">
                        <b>{f.name}</b>
                        <div className="faint small">
                          {f.nodes} Nodes{f.needsHuman ? " · waits for people at its Human Nodes" : ""}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="field">
              <label>Machine</label>
              {!machine?.paired ? (
                <div className="banner fail">
                  <div className="grow small">
                    <b>You have no paired Machine yet.</b> Runs always run on the Starter&apos;s own computer.
                  </div>
                  <Link className="btn sm primary" href="/machines">
                    Pair my computer
                  </Link>
                </div>
              ) : machine.connected && !machine.ready ? (
                <div className="banner fail">
                  <div className="grow small">
                    <b>Your Machine is not logged in to Claude Code and gh.</b> Log in on it in your own terminal, then check logins on its page.
                  </div>
                  <Link className="btn sm" href={`/machines/${machine.id}`}>
                    Open my Machine
                  </Link>
                </div>
              ) : (
                <div className="opt-card on" style={{ cursor: "default" }}>
                  {Icon.host}
                  <div className="grow">
                    <b>My Machine</b> <span className="faint small">· {machine.connected ? "online" : "offline"}</span>
                    <div className="faint small num">
                      {machine.inUse}/{machine.slots} Slots busy · {machine.queued} queued
                    </div>
                  </div>
                </div>
              )}
              {machine?.paired && !machine.connected && <span className="hint">Your Machine is offline. Runs wait in its queue until its Agent connects.</span>}
              {machine && (
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
                {plural(2)} <span className="faint num">{dialog.items.length}</span>
              </label>
              <div className="pick">
                {dialog.items.map((t) => (
                  <div key={t.id}>
                    <span className="mono faint small">{t.key}</span>
                    <span className="grow">{t.title}</span>
                    {t.warning && (
                      <span className="pill wait plain" title={t.warning.title}>
                        {t.warning.label}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {dialog.warningHint && dialog.items.some((t) => t.warning) && <span className="hint">{dialog.warningHint}</span>}
            </div>

            {error && (
              <div className="banner fail" role="alert">
                <div className="grow small">{error.text}</div>
                {error.machinePage && (
                  <Link className="btn sm" href={error.machinePage}>
                    Open Machines
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
          <button type="button" className="btn primary" disabled={!dialog || pending || !flowId || !machine?.paired} onClick={() => void go()}>
            {Icon.play}
            {pending ? "Starting…" : `Start ${count} Run${count === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </dialog>
  );
}
