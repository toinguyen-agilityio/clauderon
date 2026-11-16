"use client";

import { useActionState } from "react";
import { addEmail, type FormState } from "./actions";

export function AddEmailForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addEmail, { error: null });
  return (
    <form action={action} className="row">
      <input type="email" name="email" placeholder="name@example.com" required aria-label="Email to allow" />
      <button className="primary" type="submit" disabled={pending}>
        Add an email
      </button>
      {state.error && <span className="error">{state.error}</span>}
    </form>
  );
}
