"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Icon } from "../../../components/icons";
import { podActionAction, type PodFormState } from "./actions";

/** Start or Stop, Refresh and Open terminal on the owner's own Pod (POD-4, POD-6). */
export function PodActions({ podId, status, busy }: { podId: string; status: string; busy: boolean }) {
  const [state, action, pending] = useActionState<PodFormState, FormData>(podActionAction, { error: null });
  const running = status === "running";
  return (
    <div className="stack" style={{ gap: 6 }}>
      <form action={action} className="pod-actions">
        <input type="hidden" name="podId" value={podId} />
        {running ? (
          <button type="submit" name="action" value="stop" className="btn sm" disabled={pending || busy} title={busy ? "Refused while Runs are running or waiting" : undefined}>
            {Icon.stop}
            Stop
          </button>
        ) : (
          <button type="submit" name="action" value="start" className="btn sm" disabled={pending || status === "creating"}>
            {Icon.play}
            Start
          </button>
        )}
        <button type="submit" name="action" value="refresh" className="btn sm" disabled={pending || !running} title="Check the Claude Code and gh logins again">
          {Icon.sync}
          Refresh
        </button>
        {running ? (
          <Link className="btn sm primary" href={`/pods/${podId}/terminal`}>
            {Icon.terminal}
            Open terminal
          </Link>
        ) : (
          <button type="button" className="btn sm primary" disabled title="Start the Pod first">
            {Icon.terminal}
            Open terminal
          </button>
        )}
      </form>
      {state.error && (
        <span className="err-text small" role="alert">
          {state.error}
        </span>
      )}
    </div>
  );
}
