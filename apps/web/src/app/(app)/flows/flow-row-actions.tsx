"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { closeOnBackdrop } from "../../../components/dialog";
import { Icon } from "../../../components/icons";
import { exportFlowAction, flowActionAction, type FlowFormState } from "./actions";

/**
 * Clone, Export and Delete on one Flow, samples included (FLW-8, FLW-9), as quiet icon buttons whose
 * name shows on hover; the row itself opens the Flow. Delete asks in a dialog first; a Flow that an Active Run locks cannot be deleted,
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

  // After a clone, bring the new card into view and highlight it. The list refreshes after the
  // action, so the card may arrive a moment later: look for it for a short while.
  useEffect(() => {
    const id = state.openFlowId;
    if (!id) return;
    let tries = 0;
    let frame = 0;
    const find = () => {
      const card = document.getElementById(`flow-${id}`);
      if (card) {
        card.scrollIntoView({ block: "center", behavior: "smooth" });
        card.classList.add("just-cloned");
        return;
      }
      if (++tries < 60) frame = requestAnimationFrame(find);
    };
    find();
    return () => cancelAnimationFrame(frame);
  }, [state.openFlowId]);

  return (
    <div className="flow-actions">
      <form action={action} className="row" style={{ gap: 6 }}>
        <input type="hidden" name="flowId" value={flowId} />
        <button type="submit" name="action" value="clone" className="btn sm icon ghost" disabled={pending} aria-label={`Clone ${name}`} data-tip="Clone">
          {Icon.copy}
        </button>
        <button type="button" className="btn sm icon ghost" disabled={exporting} aria-label={`Export ${name}`} data-tip={exporting ? "Exporting…" : "Export"} onClick={() => void exportFlow()}>
          {exporting ? Icon.spin : Icon.download}
        </button>
        <button
          type="button"
          className="btn sm icon ghost danger-hover"
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
