"use client";

import { useState } from "react";

/** A command to copy and run in a terminal. */
export function CmdBox({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    void navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  return (
    <div className="cmd-box">
      <code className="mono">{command}</code>
      <button type="button" className="btn ghost sm" onClick={copy} aria-label="Copy command">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
