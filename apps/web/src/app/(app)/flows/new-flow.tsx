"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { closeOnBackdrop } from "../../../components/dialog";
import { Icon } from "../../../components/icons";
import { createFlowAction } from "./actions";

/** New Flow (FLW-9): a button on the Flows page that asks for a name, then opens the editor with the Ticket Node placed. */
export function NewFlow() {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const open = () => {
    setName("");
    setError(null);
    ref.current?.showModal();
  };

  const submit = async () => {
    if (!name.trim()) return;
    setPending(true);
    setError(null);
    const result = await createFlowAction(name);
    setPending(false);
    if (!result.ok) return setError(result.error);
    ref.current?.close();
    router.push(`/flows/${result.flowId}`);
  };

  return (
    <>
      <button type="button" className="btn primary" onClick={open}>
        {Icon.plus}
        New Flow
      </button>
      <dialog ref={ref} {...closeOnBackdrop} className="modal" aria-labelledby="new-flow-title">
        <form
          className="modal-in"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="modal-h">
            <h2 id="new-flow-title">New Flow</h2>
            <button type="button" className="btn ghost sm" aria-label="Close" onClick={() => ref.current?.close()}>
              {Icon.x}
            </button>
          </div>
          <div className="modal-b">
            <p className="small muted">The Flow starts with the Ticket Input, which you can swap for another Input; add the steps after it in the editor.</p>
            <input
              className="input"
              aria-label="Flow name"
              placeholder="Flow name"
              maxLength={120}
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
            {error && (
              <span className="err-text small" role="alert">
                {error}
              </span>
            )}
          </div>
          <div className="modal-f">
            <button type="button" className="btn" onClick={() => ref.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={!name.trim() || pending}>
              {pending ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
