"use client";

import { useActionState, useEffect, useRef } from "react";
import { Icon } from "../../../components/icons";
import { setLimitsAction, type LimitsFormState } from "./actions";
import { POD_NAME_MAX } from "./pod-parts";

type Limits = { slots: number; cpus: number; memoryMb: number };

/**
 * The owner's Pod settings (POD-2) in a dialog opened by its own button: name,
 * Slots, CPU and RAM.
 * Slots apply at once, CPU and RAM at the next Recreate.
 */
export function PodLimits({
  podId,
  name,
  defaultName,
  limits,
  ceiling,
  label,
  small,
}: {
  podId: string;
  name: string | null;
  defaultName: string;
  limits: Limits;
  ceiling: Limits;
  label: string;
  small?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<LimitsFormState, FormData>(setLimitsAction, { error: null, saved: false });

  useEffect(() => {
    if (state.saved) ref.current?.close();
  }, [state]);

  return (
    <>
      <button type="button" className={`btn ${small ? "sm" : ""}`} onClick={() => ref.current?.showModal()}>
        {label}
      </button>
      <dialog ref={ref} className="modal" aria-labelledby={`limits-${podId}`}>
        <form action={action} className="modal-in">
          <div className="modal-h">
            <div>
              <h2 id={`limits-${podId}`}>Pod settings</h2>
              <p className="muted small" style={{ marginTop: 4 }}>
                Slots apply at once; lowering them stops nothing that is running. CPU and RAM apply at the next Recreate.
              </p>
            </div>
            <button type="button" className="btn ghost sm" aria-label="Close" onClick={() => ref.current?.close()}>
              {Icon.x}
            </button>
          </div>
          <div className="modal-b">
            <input type="hidden" name="podId" value={podId} />
            <label className="stack small" style={{ gap: 4 }}>
              <b>Name</b>
              <input className="input" name="name" maxLength={POD_NAME_MAX} defaultValue={name ?? ""} placeholder={defaultName} />
              <span className="hint">Leave it empty for “{defaultName}”.</span>
            </label>
            <label className="stack small" style={{ gap: 4 }}>
              <b>Slots</b>
              <input className="input" name="slots" type="number" min={1} max={ceiling.slots} step={1} defaultValue={limits.slots} required />
              <span className="hint">Runs at once on this Pod, up to {ceiling.slots}.</span>
            </label>
            <label className="stack small" style={{ gap: 4 }}>
              <b>CPU</b>
              <input className="input" name="cpus" type="number" min={0.5} max={ceiling.cpus} step={0.5} defaultValue={limits.cpus} required />
              <span className="hint">Up to {ceiling.cpus} cores.</span>
            </label>
            <label className="stack small" style={{ gap: 4 }}>
              <b>RAM in GB</b>
              <input className="input" name="memoryGb" type="number" min={0.5} max={ceiling.memoryMb / 1024} step={0.5} defaultValue={limits.memoryMb / 1024} required />
              <span className="hint">Up to {ceiling.memoryMb / 1024} GB.</span>
            </label>
            {state.error && (
              <span className="err-text small" role="alert">
                {state.error}
              </span>
            )}
          </div>
          <div className="modal-f">
            <button type="button" className="btn" onClick={() => ref.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={pending}>
              Save
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
