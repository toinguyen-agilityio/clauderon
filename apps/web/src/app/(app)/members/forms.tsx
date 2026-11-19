"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef } from "react";
import { closeOnBackdrop } from "../../../components/dialog";
import { Icon } from "../../../components/icons";
import { addEmail, removeMachineAction, removeMemberAction, type ConfirmState, type FormState } from "./actions";

export function AddEmailForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addEmail, { error: null });
  return (
    <form action={action} className="row">
      <input className="input members-add" type="email" name="email" placeholder="name@example.com" required aria-label="Email to add" />
      <button className="btn primary" type="submit" disabled={pending}>
        {Icon.plus}
        Add member
      </button>
      {state.error && (
        <span className="err-text" role="alert">
          {state.error}
        </span>
      )}
    </form>
  );
}

type ConfirmProps = {
  trigger: string;
  title: string;
  confirm: string;
  pendingLabel: string;
  action: (state: ConfirmState, form: FormData) => Promise<ConfirmState>;
  fields: Record<string, string>;
  children: React.ReactNode;
};

/** A destructive row action behind a confirm dialog; a refusal stays in the dialog with a link to the blocking Runs. */
function Confirm({ trigger, title, confirm, pendingLabel, action, fields, children }: ConfirmProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, formAction, pending] = useActionState<ConfirmState, FormData>(action, { error: null });
  useEffect(() => {
    if (state.done) ref.current?.close();
  }, [state]);

  return (
    <>
      <button type="button" className="btn sm danger" onClick={() => ref.current?.showModal()}>
        {trigger}
      </button>
      <dialog ref={ref} {...closeOnBackdrop} className="modal" aria-labelledby={titleId}>
        <form action={formAction} className="modal-in">
          <div className="modal-h">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="btn ghost sm" aria-label="Close" onClick={() => ref.current?.close()}>
              {Icon.x}
            </button>
          </div>
          <div className="modal-b">
            {Object.entries(fields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            {children}
            {state.error && (
              <p className="err-text" role="alert">
                {state.error} {state.runsHref && <Link href={state.runsHref}>View their Runs</Link>}
              </p>
            )}
          </div>
          <div className="modal-f">
            <button type="button" className="btn" onClick={() => ref.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="btn danger solid" disabled={pending}>
              {pending ? pendingLabel : confirm}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function RemoveMachine({ machineId, who }: { machineId: string; who: string }) {
  return (
    <Confirm trigger="Remove Machine" title={`Remove ${who}'s Machine?`} confirm="Remove Machine" pendingLabel="Removing…" action={removeMachineAction} fields={{ machineId }}>
      <p>Its Agent is disconnected and its token stops working at once. The Agent&apos;s directory stays on that computer for its owner to delete.</p>
      <p className="small muted">Ended Runs stay in the Run history. Refused while the Machine has Active Runs.</p>
    </Confirm>
  );
}

export function RemoveMember({ email, who, hasMachine }: { email: string; who: string; hasMachine: boolean }) {
  return (
    <Confirm trigger="Remove" title={`Remove ${who} from the team?`} confirm="Remove member" pendingLabel="Removing…" action={removeMemberAction} fields={{ email }}>
      <p>
        <span className="mono">{email}</span> can no longer sign in. Their open sessions and live connections end at once.
      </p>
      {hasMachine && (
        <p className="banner fail small">Their Machine is removed too: its Agent is disconnected and its token stops working. To use it again they must pair it again.</p>
      )}
      <p className="small muted">Their Runs and audit entries are kept. Refused while their Machine has Active Runs.</p>
    </Confirm>
  );
}
