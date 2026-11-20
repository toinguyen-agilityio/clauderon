"use client";

import { useActionState } from "react";
import { Confirm } from "../../../components/confirm";
import { Icon } from "../../../components/icons";
import { addEmail, removeMachineAction, removeMemberAction, type FormState } from "./actions";

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
