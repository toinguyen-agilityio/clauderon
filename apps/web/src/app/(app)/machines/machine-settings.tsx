"use client";

import { useActionState, useEffect, useRef } from "react";
import { Icon } from "../../../components/icons";
import { closeOnBackdrop } from "../../../components/dialog";
import { setSettingsAction, type SettingsFormState } from "./actions";
import { MACHINE_NAME_MAX, MAX_SLOTS } from "./machine-parts";

/** The owner's Machine settings in a dialog: name and Slots, which apply at once. */
export function MachineSettings({
  machineId,
  name,
  defaultName,
  slots,
  label,
  small,
}: {
  machineId: string;
  name: string | null;
  defaultName: string;
  slots: number;
  label: string;
  small?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(setSettingsAction, { error: null, saved: false });

  useEffect(() => {
    if (state.saved) ref.current?.close();
  }, [state]);

  return (
    <>
      <button type="button" className={`btn ${small ? "sm" : ""}`} onClick={() => ref.current?.showModal()}>
        {label}
      </button>
      <dialog ref={ref} {...closeOnBackdrop} className="modal" aria-labelledby={`settings-${machineId}`}>
        <form action={action} className="modal-in">
          <div className="modal-h">
            <div>
              <h2 id={`settings-${machineId}`}>Machine settings</h2>
              <p className="muted small" style={{ marginTop: 4 }}>
                Slots apply at once; lowering them stops nothing that is running.
              </p>
            </div>
            <button type="button" className="btn ghost sm" aria-label="Close" onClick={() => ref.current?.close()}>
              {Icon.x}
            </button>
          </div>
          <div className="modal-b">
            <input type="hidden" name="machineId" value={machineId} />
            <label className="stack small" style={{ gap: 4 }}>
              <b>Name</b>
              <input className="input" name="name" maxLength={MACHINE_NAME_MAX} defaultValue={name ?? ""} placeholder={defaultName} />
              <span className="hint">Leave it empty for “{defaultName}”.</span>
            </label>
            <label className="stack small" style={{ gap: 4 }}>
              <b>Slots</b>
              <input className="input" name="slots" type="number" min={1} max={MAX_SLOTS} step={1} defaultValue={slots} required />
              <span className="hint">Runs at once on this computer, up to {MAX_SLOTS}. Each Run is a Claude Code session or a command.</span>
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
