"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { closeOnBackdrop } from "../../../components/dialog";
import { Icon } from "../../../components/icons";
import { exportFlowAction, flowActionAction, type FlowFormState } from "./actions";

/**
 * Edit, Clone, Export and Delete on one Flow, samples included (FLW-8, FLW-9), as icon buttons whose
 * name shows on hover. Delete asks in a dialog first; a Flow that an Active Run locks cannot be deleted,
 * and says why.
 */
export function FlowRowActions({ flowId, name, locked }: { flowId: string; name: string; locked: boolean }) {
  const [state, action, pending] = useActionState<FlowFormState, FormData>(flowActionAction, { error: null, notice: null, openFlowId: null });
  const confirm = useRef<HTMLDialogElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Export (issue #98): the server builds the file, the browser saves it.
  const exportFlow = async () => {
    setExporting(true);
    setExportError(null);
    const result = await exportFlowAction(flowId);
    setExporting(false);
    if (!result.ok) return setExportError(result.error);
    const url = URL.createObjectURL(new Blob([result.json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // An answer from the server (done or refused) closes the question.
  useEffect(() => {
    if (state.error || state.notice) confirm.current?.close();
  }, [state]);

  const open = locked ? "View" : "Edit";
  return (
    <div className="flow-actions">
      <form action={action} className="row" style={{ gap: 6 }}>
        <input type="hidden" name="flowId" value={flowId} />
        <Link className="btn sm icon primary" href={`/flows/${flowId}`} aria-label={`${open} ${name}`} data-tip={open}>
          {locked ? Icon.eye : Icon.pencil}
        </Link>
        <button type="submit" name="action" value="clone" className="btn sm icon" disabled={pending} aria-label={`Clone ${name}`} data-tip="Clone">
          {Icon.copy}
        </button>
        <button type="button" className="btn sm icon" disabled={exporting} aria-label={`Export ${name}`} data-tip={exporting ? "Exporting…" : "Export"} onClick={() => void exportFlow()}>
          {exporting ? Icon.spin : Icon.download}
        </button>
        <button
          type="button"
          className="btn sm icon danger"
          disabled={pending || locked}
          aria-label={`Delete ${name}`}
          data-tip={locked ? "Locked by an Active Run" : "Delete"}
          onClick={() => confirm.current?.showModal()}
        >
          {Icon.trash}
        </button>

        <dialog ref={confirm} {...closeOnBackdrop} className="modal narrow" aria-labelledby={`del-${flowId}`}>
          <div className="modal-in">
            <div className="modal-h">
              <h2 id={`del-${flowId}`}>Delete Flow?</h2>
              <button type="button" className="btn ghost sm" aria-label="Close" onClick={() => confirm.current?.close()}>
                {Icon.x}
              </button>
            </div>
            <div className="modal-b">
              <p className="small">
                <b>{name}</b> will be deleted. This cannot be undone. A Flow with Runs in its history is kept.
              </p>
            </div>
            <div className="modal-f">
              <button type="button" className="btn" disabled={pending} autoFocus onClick={() => confirm.current?.close()}>
                Keep it
              </button>
              <button type="submit" name="action" value="delete" className="btn danger solid" disabled={pending}>
                {pending ? "Deleting…" : "Delete Flow"}
              </button>
            </div>
          </div>
        </dialog>
      </form>
      {exportError && (
        <span className="err-text small" role="alert">
          {exportError}
        </span>
      )}
      {state.error && (
        <span className="err-text small" role="alert">
          {state.error}
        </span>
      )}
      {state.notice && (
        <span className="faint small" role="status">
          {state.notice}{" "}
          {state.openFlowId && (
            <Link href={`/flows/${state.openFlowId}`}>Open it</Link>
          )}
        </span>
      )}
    </div>
  );
}
