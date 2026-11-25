"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FLOW_FILE_MAX_BYTES } from "@clauderon/core";
import { closeOnBackdrop } from "../../../components/dialog";
import { Icon } from "../../../components/icons";
import { importFlowAction } from "./actions";

/** Import a Flow from a file (issue #98): a button on the Flows page that opens a small dialog. */
export function ImportFlow() {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const open = () => {
    setFile(null);
    setError(null);
    ref.current?.showModal();
  };

  const submit = async () => {
    if (!file) return;
    if (file.size > FLOW_FILE_MAX_BYTES) return setError("That file is too large to be a Flow file.");
    setPending(true);
    setError(null);
    const result = await importFlowAction(await file.text());
    setPending(false);
    if (!result.ok) return setError(result.error);
    ref.current?.close();
    router.push(`/flows/${result.flowId}`);
  };

  return (
    <>
      <button type="button" className="btn" onClick={open}>
        {Icon.upload}
        Import Flow
      </button>
      <dialog ref={ref} {...closeOnBackdrop} className="modal" aria-labelledby="import-flow-title">
        <div className="modal-in">
          <div className="modal-h">
            <h2 id="import-flow-title">Import a Flow</h2>
            <button type="button" className="btn ghost sm" aria-label="Close" onClick={() => ref.current?.close()}>
              {Icon.x}
            </button>
          </div>
          <div className="modal-b">
            <p className="small muted">
              Choose a Flow file exported from Clauderon. It becomes a new Flow of your own; nothing existing is changed. A name that is already taken gets &quot;Copy of&quot; in front.
            </p>
            <input
              type="file"
              accept=".json,application/json"
              aria-label="Flow file"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
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
            <button type="button" className="btn primary" disabled={!file || pending} onClick={() => void submit()}>
              {pending ? "Importing…" : "Import"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
