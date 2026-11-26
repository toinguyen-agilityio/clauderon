"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cloneVersionAction, restoreVersionAction } from "./actions";

/**
 * Restore (when the Flow still exists) and Clone for one version. Both ask once before they act. Restore is
 * disabled with the reason when an Active Run locks the Flow (FLW-7); the server checks it again.
 */
export function VersionActions({ flowId, versionId, flowExists, lockedReason }: { flowId: string; versionId: string; flowExists: boolean; lockedReason: string | null }) {
  const [asking, setAsking] = useState<"restore" | "clone" | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string; href?: string } | null>(null);
  const [pending, start] = useTransition();

  const run = (what: "restore" | "clone") =>
    start(async () => {
      setAsking(null);
      if (what === "restore") {
        const result = await restoreVersionAction(flowId, versionId);
        setMessage(result.ok ? { kind: "ok", text: "Restored. This version is now the current Flow.", href: `/flows/${flowId}` } : { kind: "error", text: result.error });
      } else {
        const result = await cloneVersionAction(flowId, versionId);
        setMessage(result.ok ? { kind: "ok", text: `Created ${result.name}.`, href: `/flows/${result.flowId}` } : { kind: "error", text: result.error });
      }
    });

  return (
    <div className="row" data-testid="version-actions">
      {asking ? (
        <>
          <span className="small">{asking === "restore" ? "Replace the current Flow with this version?" : "Create a new Flow from this version?"}</span>
          <button type="button" className="btn primary sm" disabled={pending} onClick={() => run(asking)}>
            {asking === "restore" ? "Confirm restore" : "Confirm clone"}
          </button>
          <button type="button" className="btn ghost sm" onClick={() => setAsking(null)}>
            Cancel
          </button>
        </>
      ) : (
        <>
          {flowExists && (
            <button type="button" className="btn sm" disabled={pending || lockedReason !== null} title={lockedReason ?? "Make this version the current Flow."} onClick={() => setAsking("restore")}>
              Restore this version
            </button>
          )}
          <button type="button" className="btn sm" disabled={pending} title="Create a new Flow from this version." onClick={() => setAsking("clone")}>
            Clone as a new Flow
          </button>
        </>
      )}
      {lockedReason && flowExists && <span className="small faint">{lockedReason}</span>}
      {message && (
        <span className="small" role="status">
          {message.text} {message.href && <Link href={message.href}>Open</Link>}
        </span>
      )}
    </div>
  );
}
