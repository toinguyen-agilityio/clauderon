"use client";

import { useActionState, useRef } from "react";
import { Icon } from "../../../../components/icons";
import { cancelRunAction, type CancelFormState } from "./actions";
import { closeOnBackdrop } from "../../../../components/dialog";

/** Cancel on any Active Run, behind a confirm dialog (RUN-8). Once it ends, the page drops this button. */
export function CancelRun({ runId, running }: { runId: string; running: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<CancelFormState, FormData>(cancelRunAction, { error: null });

  return (
    <>
      <button type="button" className="btn danger" onClick={() => ref.current?.showModal()} data-testid="run-cancel">
        Cancel Run
      </button>
      <dialog ref={ref} {...closeOnBackdrop} className="modal" aria-labelledby="cancel-run-title">
        <form action={action} className="modal-in">
          <div className="modal-h">
            <h2 id="cancel-run-title">Cancel this Run?</h2>
            <button type="button" className="btn ghost sm" aria-label="Close" onClick={() => ref.current?.close()}>
              {Icon.x}
            </button>
          </div>
          <div className="modal-b">
            <input type="hidden" name="runId" value={runId} />
            <p>The Run ends as Cancelled for good and frees its Slot. It cannot be retried.</p>
            {running && <p className="small muted">The Node running now is stopped on its Machine.</p>}
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
              {pending ? "Cancelling…" : "Cancel Run"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
