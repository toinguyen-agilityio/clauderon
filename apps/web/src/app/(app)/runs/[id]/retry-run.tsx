"use client";

import { useActionState, useRef } from "react";
import { Icon } from "../../../../components/icons";
import { OutputValue } from "../../../../components/output-value";
import { MarkdownText } from "../../../../components/markdown-text";
import { OType } from "../../../../components/state-pill";
import { retryRunAction, type RetryFormState } from "./actions";
import { closeOnBackdrop } from "../../../../components/dialog";

type Input = { name: string; type: string; value: unknown };

/**
 * Retry from here (RUN-7, spec M3 §4): shows what the Node will receive (its
 * inputs and the retry context) and takes an optional note.
 */
export function RetryFromHere({ runId, nodeId, nodeName, inputs, context }: { runId: string; nodeId: string; nodeName: string; inputs: Input[]; context: string | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<RetryFormState, FormData>(retryRunAction, { error: null });

  return (
    <>
      <button type="button" className="btn sm" onClick={() => ref.current?.showModal()} data-testid="retry-from-here">
        Retry from here
      </button>
      <dialog ref={ref} {...closeOnBackdrop} className="modal wide" aria-labelledby={`retry-${nodeId}`}>
        <form action={action} className="modal-in">
          <div className="modal-h">
            <div>
              <h2 id={`retry-${nodeId}`}>Retry from “{nodeName}”</h2>
              <p className="muted small" style={{ marginTop: 4 }}>
                This Node and every later one run again as new Attempts; earlier Attempts stay visible. The Run joins the end of its Machine&apos;s queue and keeps its worktree.
              </p>
            </div>
            <button type="button" className="btn ghost sm" aria-label="Close" onClick={() => ref.current?.close()}>
              {Icon.x}
            </button>
          </div>
          <div className="modal-b">
            <input type="hidden" name="runId" value={runId} />
            <input type="hidden" name="nodeId" value={nodeId} />
            <div className="stack" style={{ gap: 8 }}>
              <span className="eyebrow">It will receive</span>
              {inputs.length === 0 && <span className="faint small">No inputs</span>}
              {inputs.map((i) => (
                <div key={i.name} className="stack" style={{ gap: 4 }}>
                  <OType type={i.type} label={i.name} />
                  <OutputValue type={i.type} value={i.value} />
                </div>
              ))}
              {context && (
                <>
                  <span className="eyebrow">and this retry context</span>
                  <MarkdownText text={context} />
                </>
              )}
            </div>
            <div className="field">
              <label htmlFor={`note-${nodeId}`}>Note (optional)</label>
              <textarea className="textarea" id={`note-${nodeId}`} name="note" maxLength={4000} placeholder="Anything the Node should know this time" />
            </div>
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
            <button type="submit" className="btn primary" disabled={pending}>
              {pending ? "Retrying…" : "Retry"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
