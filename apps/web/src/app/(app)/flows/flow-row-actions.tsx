"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { exportFlowAction, flowActionAction, type FlowFormState } from "./actions";

/**
 * Open, Clone and Delete on one Flow (FLW-8, FLW-9). A sample is opened to look at, a Flow to edit. Delete asks
 * first; a sample or a Flow that an Active Run locks cannot be deleted, and says why.
 */
export function FlowRowActions({ flowId, sample, locked }: { flowId: string; sample: boolean; locked: boolean }) {
  const [state, action, pending] = useActionState<FlowFormState, FormData>(flowActionAction, { error: null, notice: null, openFlowId: null });
  const [confirming, setConfirming] = useState(false);
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
    if (state.error || state.notice) setConfirming(false);
  }, [state]);

  return (
    <div className="flow-actions">
      <form action={action} className="row" style={{ gap: 6 }}>
        <input type="hidden" name="flowId" value={flowId} />
        <Link className="btn sm primary" href={`/flows/${flowId}`}>
          {sample ? "View" : "Edit"}
        </Link>
        <button type="submit" name="action" value="clone" className="btn sm" disabled={pending}>
          Clone
        </button>
        <button type="button" className="btn sm" disabled={exporting} onClick={() => void exportFlow()}>
          {exporting ? "Exporting…" : "Export"}
        </button>
        {!sample && !confirming && (
          <button type="button" className="btn sm" disabled={pending || locked} title={locked ? "Locked by an Active Run" : undefined} onClick={() => setConfirming(true)}>
            Delete
          </button>
        )}
        {!sample && confirming && (
          <>
            <button type="button" className="btn sm ghost" disabled={pending} onClick={() => setConfirming(false)}>
              Keep it
            </button>
            <button type="submit" name="action" value="delete" className="btn sm danger solid" disabled={pending}>
              Delete Flow
            </button>
          </>
        )}
      </form>
      {confirming && <span className="small faint">Delete this Flow? This cannot be undone.</span>}
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
