"use client";

import { useActionState, useRef } from "react";
import { Icon } from "../../../components/icons";
import { closeOnBackdrop } from "../../../components/dialog";
import { checkLoginsAction, removeMachineAction, unpairAction, updateAgentAction, type MachineFormState, type UpdateFormState } from "./actions";
import { AutoRefresh } from "./auto-refresh";

/** Check logins on the owner's own Machine (POD-5): its Agent answers once connected. */
export function CheckLogins({ machineId, connected }: { machineId: string; connected: boolean }) {
  const [, action, pending] = useActionState<MachineFormState, FormData>(checkLoginsAction, { error: null });
  return (
    <form action={action}>
      <input type="hidden" name="machineId" value={machineId} />
      <button type="submit" className="btn sm" disabled={pending} title={connected ? "Check the Claude Code and gh logins again" : "Checked once the Agent connects"}>
        {Icon.sync}
        Check logins
      </button>
    </form>
  );
}

/**
 * Update the owner's Agent now (ADR 0007). The Gateway closes its link; the
 * Agent reconnects and takes the newest bundle once no Node runs. The button
 * goes away when the version matches, so the page only polls after a click.
 */
export function UpdateAgent({ machineId, latest }: { machineId: string; latest: string }) {
  const [state, action, pending] = useActionState<UpdateFormState, FormData>(updateAgentAction, { error: null, asked: false });
  return (
    <form action={action} className="row" style={{ gap: 6 }} data-testid="machine-update-agent">
      <input type="hidden" name="machineId" value={machineId} />
      <button type="submit" className="btn sm" disabled={pending || state.asked} title={`Update the Agent to ${latest} now, instead of at its next connect`}>
        {pending ? Icon.spin : Icon.download}
        {state.asked ? "Updating…" : "Update agent"}
      </button>
      {state.asked && (
        <span className="faint small" role="status">
          Asked the Agent. It updates once no Node is running.
        </span>
      )}
      {state.asked && <AutoRefresh everyMs={5000} />}
    </form>
  );
}

/** A danger-zone action behind a confirm dialog. */
function Confirmed({
  title,
  body,
  button,
  pendingLabel,
  machineId,
  action: serverAction,
  testId,
}: {
  title: string;
  body: string;
  button: string;
  pendingLabel: string;
  machineId: string;
  action: (state: MachineFormState, form: FormData) => Promise<MachineFormState>;
  testId: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<MachineFormState, FormData>(serverAction, { error: null });
  return (
    <div className="card card-pad row between danger-zone" data-testid={testId}>
      <div className="grow">
        <h3>{button}</h3>
        <p className="small muted" style={{ marginTop: 4 }}>
          {body}
        </p>
      </div>
      <button type="button" className="btn danger" onClick={() => ref.current?.showModal()}>
        {button}
      </button>
      <dialog ref={ref} {...closeOnBackdrop} className="modal" aria-labelledby={`${testId}-title`}>
        <form action={action} className="modal-in">
          <div className="modal-h">
            <h2 id={`${testId}-title`}>{title}</h2>
            <button type="button" className="btn ghost sm" aria-label="Close" onClick={() => ref.current?.close()}>
              {Icon.x}
            </button>
          </div>
          <div className="modal-b">
            <input type="hidden" name="machineId" value={machineId} />
            <p>{body}</p>
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
            <button type="submit" className="btn danger solid" disabled={pending}>
              {pending ? pendingLabel : button}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

export function UnpairMachine({ machineId, name }: { machineId: string; name: string }) {
  return (
    <Confirmed
      testId="machine-unpair"
      title={`Unpair ${name}?`}
      body="Its Agent is disconnected at once and its Running Runs become Interrupted. Slots, queue and Run history stay; pair a computer again to go on."
      button="Unpair"
      pendingLabel="Unpairing…"
      machineId={machineId}
      action={unpairAction}
    />
  );
}

export function RemoveMachine({ machineId, name }: { machineId: string; name: string }) {
  return (
    <Confirmed
      testId="machine-remove"
      title={`Remove ${name}?`}
      body="Deletes the Machine and its settings; Run history stays without a Machine. Refused while it has Active Runs. The Agent's directory (~/.clauderon) stays on the computer."
      button="Remove Machine"
      pendingLabel="Removing…"
      machineId={machineId}
      action={removeMachineAction}
    />
  );
}
