"use client";

import { useEffect, useRef } from "react";
import { closeOnBackdrop } from "../../../../components/dialog";
import type { PendingLeave } from "./use-leave-guard";

/** Asks before leaving the Flow editor with unsaved changes. Esc, the backdrop and "Keep editing" all stay. */
export function LeaveDialog({ pending, onStay, onLeave }: { pending: PendingLeave | null; onStay: () => void; onLeave: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (pending && !dialog.open) dialog.showModal();
    if (!pending && dialog.open) dialog.close();
  }, [pending]);

  return (
    <dialog ref={ref} {...closeOnBackdrop} className="modal" aria-labelledby="leave-flow-title" onClose={onStay}>
      <div className="modal-in">
        <div className="modal-h">
          <h2 id="leave-flow-title">Leave without saving?</h2>
        </div>
        <div className="modal-b">
          <p>This Flow has changes that are not saved. If you leave now they are lost.</p>
        </div>
        <div className="modal-f">
          <button type="button" className="btn primary" autoFocus onClick={onStay}>
            Keep editing
          </button>
          <button type="button" className="btn danger solid" onClick={onLeave}>
            Leave without saving
          </button>
        </div>
      </div>
    </dialog>
  );
}
