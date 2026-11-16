"use client";

import Link from "next/link";
import { useActionState } from "react";
import { podActionAction, type PodFormState } from "./actions";

/** Start, Stop, Refresh and Open terminal on the owner's own row (POD-4). */
export function PodActions({ podId, status }: { podId: string; status: string }) {
  const [state, action, pending] = useActionState<PodFormState, FormData>(podActionAction, { error: null });
  const button = (name: string, label: string, disabled = false) => (
    <button type="submit" name="action" value={name} className="btn sm" disabled={pending || disabled}>
      {label}
    </button>
  );
  return (
    <div className="stack" style={{ alignItems: "flex-end", gap: 4 }}>
      <form action={action} className="pod-actions">
        <input type="hidden" name="podId" value={podId} />
        {status === "running" ? button("stop", "Stop") : button("start", "Start", status === "creating")}
        {button("refresh", "Refresh", status !== "running")}
        <Link className="btn sm primary" href={`/pods/${podId}/terminal`} aria-disabled={status !== "running"}>
          Open terminal
        </Link>
      </form>
      {state.error && <span className="err-text small">{state.error}</span>}
    </div>
  );
}
