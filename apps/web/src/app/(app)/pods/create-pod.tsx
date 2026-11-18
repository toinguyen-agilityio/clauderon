"use client";

import { useActionState, useRef } from "react";
import { Icon } from "../../../components/icons";
import { createPodAction, type PodFormState } from "./actions";
import { POD_NAME_MAX } from "./pod-parts";

type Limits = { slots: number; cpus: number; memoryMb: number };

/**
 * Create my Pod opens a dialog first, so a stray click no longer creates a
 * container: it shows what the Pod gets and lets the Member change the limits.
 */
export function CreatePod({
  defaults,
  ceiling,
  defaultName,
  className = "btn primary",
}: {
  defaults: Limits;
  ceiling: Limits;
  defaultName: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<PodFormState, FormData>(createPodAction, { error: null });

  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.showModal()}>
        {Icon.plus}
        Create my Pod
      </button>
      <dialog ref={ref} className="modal" aria-labelledby="create-pod-title">
        <form action={action} className="modal-in">
          <div className="modal-h">
            <div>
              <h2 id="create-pod-title">Create my Pod</h2>
              <p className="muted small" style={{ marginTop: 4 }}>
                One Docker container for you on the Pod Host, with its own Workspace. Your Runs run there under your own Claude Code and gh
                logins.
              </p>
            </div>
            <button type="button" className="btn ghost sm" aria-label="Close" onClick={() => ref.current?.close()}>
              {Icon.x}
            </button>
          </div>
          <div className="modal-b">
            <label className="stack small" style={{ gap: 4 }}>
              <b>Name</b>
              <input className="input" name="name" maxLength={POD_NAME_MAX} placeholder={defaultName} autoFocus />
              <span className="hint">Shown on the Pods page and on Runs. Leave it empty for “{defaultName}”.</span>
            </label>
            <label className="stack small" style={{ gap: 4 }}>
              <b>Slots</b>
              <input className="input" name="slots" type="number" min={1} max={ceiling.slots} step={1} defaultValue={defaults.slots} required />
              <span className="hint">Runs at once on your Pod, up to {ceiling.slots}. You can change it later.</span>
            </label>
            <div className="grid g2" style={{ gap: 12 }}>
              <label className="stack small" style={{ gap: 4 }}>
                <b>CPU</b>
                <input className="input" name="cpus" type="number" min={0.5} max={ceiling.cpus} step={0.5} defaultValue={defaults.cpus} required />
                <span className="hint">Up to {ceiling.cpus} cores.</span>
              </label>
              <label className="stack small" style={{ gap: 4 }}>
                <b>RAM in GB</b>
                <input className="input" name="memoryGb" type="number" min={0.5} max={ceiling.memoryMb / 1024} step={0.5} defaultValue={defaults.memoryMb / 1024} required />
                <span className="hint">Up to {ceiling.memoryMb / 1024} GB.</span>
              </label>
            </div>
            <div className="banner info">
              <div className="grow small">
                Next, the Pod page walks you through logging in to Claude Code and GitHub, with one button that runs every step in the web
                terminal.
              </div>
            </div>
            {state.error && (
              <span className="err-text small" role="alert">
                {state.error}
              </span>
            )}
          </div>
          <div className="modal-f">
            <button type="button" className="btn" onClick={() => ref.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={pending}>
              {Icon.plus}
              {pending ? "Creating…" : "Create Pod"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
