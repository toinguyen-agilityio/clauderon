"use client";

import { useActionState, useRef } from "react";
import { Icon } from "../../../components/icons";
import { removePodAction, type PodFormState } from "./actions";
import { closeOnBackdrop } from "../../../components/dialog";

/** The danger zone on the Pod page: Remove Pod behind a confirm dialog (POD-7). */
export function RemovePod({ podId, podName, mine }: { podId: string; podName: string; mine: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<PodFormState, FormData>(removePodAction, { error: null });

  return (
    <div className="card card-pad row between danger-zone" data-testid="pod-remove">
      <div className="grow">
        <h3>Remove Pod</h3>
        <p className="small muted" style={{ marginTop: 4 }}>
          Deletes the container and its Workspace on the Pod Host, with the Claude Code and gh logins and every clone and worktree. Run
          history stays. Refused while the Pod has Active Runs.
        </p>
      </div>
      <button type="button" className="btn danger" onClick={() => ref.current?.showModal()}>
        Remove Pod
      </button>
      <dialog ref={ref} {...closeOnBackdrop} className="modal" aria-labelledby="remove-pod-title">
        <form action={action} className="modal-in">
          <div className="modal-h">
            <h2 id="remove-pod-title">Remove {podName}?</h2>
            <button type="button" className="btn ghost sm" aria-label="Close" onClick={() => ref.current?.close()}>
              {Icon.x}
            </button>
          </div>
          <div className="modal-b">
            <input type="hidden" name="podId" value={podId} />
            <p>The container and its Workspace are deleted, logins included. This cannot be undone.</p>
            <p className="small muted">
              Ended Runs stay in the Run history without a Pod.{" "}
              {mine ? "You can create a new Pod afterwards." : "Its owner can create a new Pod afterwards."}
            </p>
            {state.error && (
              <span className="err-text small" role="alert">
                {state.error}
              </span>
            )}
          </div>
          <div className="modal-f">
            <button type="button" className="btn" onClick={() => ref.current?.close()}>
              Keep it
            </button>
            <button type="submit" className="btn danger solid" disabled={pending}>
              {pending ? "Removing…" : "Remove Pod"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
