"use client";

import { useRef, useState } from "react";
import { NODE_FILE_MAX_BYTES } from "@clauderon/core";
import { closeOnBackdrop } from "../../../../components/dialog";
import { Icon } from "../../../../components/icons";
import { importNodesAction } from "./actions";
import { importSummary } from "./library-view";

/** Import Nodes from a file (issue #116): a button beside New Node that opens a small dialog. */
export function ImportNodes() {
  const ref = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const open = () => {
    setFile(null);
    setError(null);
    setDone(null);
    ref.current?.showModal();
  };

  const submit = async () => {
    if (!file) return;
    if (file.size > NODE_FILE_MAX_BYTES) return setError("That file is too large to be a Node file.");
    setPending(true);
    setError(null);
    const result = await importNodesAction(await file.text());
    setPending(false);
    if (!result.ok) return setError(result.error);
    setFile(null);
    setDone(importSummary(result));
  };

  return (
    <>
      <button type="button" className="btn" onClick={open}>
        Import Node
      </button>
      <dialog ref={ref} {...closeOnBackdrop} className="modal" aria-labelledby="import-node-title">
        <div className="modal-in">
          <div className="modal-h">
            <h2 id="import-node-title">Import Nodes</h2>
            <button type="button" className="btn ghost sm" aria-label="Close" onClick={() => ref.current?.close()}>
              {Icon.x}
            </button>
          </div>
          <div className="modal-b">
            <p className="small muted">
              Choose a Node file exported from Clauderon. If any Node in it is not valid, nothing is created. A Node the library already has is skipped; a different Node with a taken name gets &quot;Copy of&quot; in front.
            </p>
            <input
              type="file"
              accept=".json,application/json"
              aria-label="Node file"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
                setDone(null);
              }}
            />
            {error && (
              <span className="err-text small" role="alert">
                {error}
              </span>
            )}
            {done && (
              <span className="small" role="status">
                {done}
              </span>
            )}
          </div>
          <div className="modal-f">
            <button type="button" className="btn" onClick={() => ref.current?.close()}>
              {done ? "Close" : "Cancel"}
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
