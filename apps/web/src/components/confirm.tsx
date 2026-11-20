"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef } from "react";
import { closeOnBackdrop } from "./dialog";
import { Icon } from "./icons";

/** `runsHref` links to the Runs that block the action. */
export type ConfirmState = { error: string | null; runsHref?: string; done?: boolean };

type ConfirmProps = {
  trigger: string;
  title: string;
  confirm: string;
  pendingLabel: string;
  action: (state: ConfirmState, form: FormData) => Promise<ConfirmState>;
  fields: Record<string, string>;
  /** Text of the link to `runsHref` shown with a refusal. */
  linkLabel?: string;
  children: React.ReactNode;
};

/** A destructive row action behind a confirm dialog; a refusal stays in the dialog with a link to the blocking Runs. */
export function Confirm({ trigger, title, confirm, pendingLabel, action, fields, linkLabel = "View their Runs", children }: ConfirmProps) {
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
                {state.error} {state.runsHref && <Link href={state.runsHref}>{linkLabel}</Link>}
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
