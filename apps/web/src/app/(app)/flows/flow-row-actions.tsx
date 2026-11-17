"use client";

import { useActionState } from "react";
import { flowActionAction, type FlowFormState } from "./actions";

/** Clone and Delete on one Flow row (FLW-8, FLW-9); samples and locked Flows cannot be deleted. */
export function FlowRowActions({ flowId, sample, locked }: { flowId: string; sample: boolean; locked: boolean }) {
  const [state, action, pending] = useActionState<FlowFormState, FormData>(flowActionAction, { error: null, notice: null });
  return (
    <div className="stack" style={{ gap: 4, alignItems: "flex-end" }}>
      <form action={action} className="row" style={{ gap: 6 }}>
        <input type="hidden" name="flowId" value={flowId} />
        <button type="submit" name="action" value="clone" className="btn sm" disabled={pending}>
          Clone
        </button>
        {!sample && (
          <button
            type="submit"
            name="action"
            value="delete"
            className="btn sm"
            disabled={pending || locked}
            title={locked ? "Locked by an Active Run" : undefined}
          >
            Delete
          </button>
        )}
      </form>
      {state.error && (
        <span className="err-text small" role="alert">
          {state.error}
        </span>
      )}
      {state.notice && <span className="faint small">{state.notice}</span>}
    </div>
  );
}
