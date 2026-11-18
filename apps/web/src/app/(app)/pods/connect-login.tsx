"use client";

import { useEffect, useRef, useState } from "react";
import { openGatewaySocket } from "../../../components/gateway-socket";
import { Icon } from "../../../components/icons";
import { readLoginOutput, stripAnsi, type LoginTool } from "../../../components/pod-login-output";

type Phase = "idle" | "starting" | "waiting" | "sent" | "checking" | "failed";

const TIMEOUT_MS = 30_000;
const LABEL: Record<LoginTool, string> = { gh: "Connect GitHub", claude: "Connect Claude Code" };

/**
 * A Connect button (POD-5): runs the Host Agent's login command in the Pod
 * over the terminal socket, without showing a terminal. gh gets a one-time
 * code to copy and a link to GitHub's device page; Claude gets a sign-in link
 * and a box for the code it shows. When the command exits, the Gateway checks
 * the logins and the page (which refreshes itself) ticks the step.
 */
export function ConnectLogin({ gatewayUrl, podId, tool }: { gatewayUrl: string; podId: string; tool: LoginTool }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [output, setOutput] = useState("");
  const [pasted, setPasted] = useState("");
  const [copied, setCopied] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const prompt = readLoginOutput(tool, output);

  // Never leave a login running in the Pod when the page goes away.
  useEffect(() => () => socket.current?.close(), []);

  // The CLI said it failed (a wrong code, an expired one): say so at once.
  useEffect(() => {
    if (prompt.error && (phase === "sent" || phase === "checking")) setPhase("failed");
  }, [prompt.error, phase]);

  // No code or link in time, or still not logged in after the command ended.
  useEffect(() => {
    const stuck = ((phase === "starting" || phase === "waiting") && !prompt.url) || phase === "checking";
    if (!stuck) return;
    const timer = setTimeout(() => setPhase("failed"), TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [phase, prompt.url]);

  const start = async () => {
    setPhase("starting");
    setOutput("");
    setPasted("");
    const ws = await openGatewaySocket(gatewayUrl, "/terminal", { podId, cols: "1000", rows: "40", login: tool });
    if (!ws) return setPhase("failed");
    socket.current = ws;
    ws.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as { type: string; data?: string };
      if (message.type === "output" && message.data) {
        setOutput((o) => o + message.data);
        setPhase((p) => (p === "starting" ? "waiting" : p));
      }
    };
    // The command ended: the Gateway checks the logins; the page refreshes itself.
    ws.onclose = () => setPhase((p) => (p === "idle" || p === "failed" ? p : "checking"));
  };

  const cancel = () => {
    socket.current?.close();
    socket.current = null;
    setPhase("idle");
  };

  const sendCode = () => {
    const code = pasted.trim();
    if (!code || socket.current?.readyState !== WebSocket.OPEN) return;
    socket.current.send(JSON.stringify({ type: "input", data: `${code}\r` }));
    setPhase("sent");
  };

  const copy = (text: string) =>
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });

  if (phase === "idle") {
    return (
      <div className="row">
        <button type="button" className="btn primary sm" onClick={() => void start()}>
          {LABEL[tool]}
        </button>
      </div>
    );
  }

  return (
    <div className="connect-box" data-testid={`connect-${tool}`}>
      {phase === "starting" || (phase === "waiting" && !prompt.url) ? (
        <span className="row small muted">
          {Icon.spin} Starting the login in your Pod…
        </span>
      ) : null}

      {tool === "gh" && prompt.code && (phase === "waiting" || phase === "sent") && (
        <div className="stack" style={{ gap: 10 }}>
          <span className="small">
            <b>1.</b> Copy this code
          </span>
          <div className="row">
            <span className="device-code mono">{prompt.code}</span>
            <button type="button" className="btn sm" onClick={() => copy(prompt.code!)}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <span className="small">
            <b>2.</b> Paste it on GitHub and authorize
          </span>
          <div className="row">
            <a className="btn primary sm" href={prompt.url!} target="_blank" rel="noreferrer">
              Open GitHub {Icon.external}
            </a>
          </div>
          <span className="row small faint">
            {Icon.spin} Waiting for GitHub. This finishes by itself.
          </span>
        </div>
      )}

      {tool === "claude" && prompt.url && phase === "waiting" && (
        <div className="stack" style={{ gap: 10 }}>
          <span className="small">
            <b>1.</b> Sign in to Claude
          </span>
          <div className="row">
            <a className="btn primary sm" href={prompt.url} target="_blank" rel="noreferrer">
              Open Claude sign-in {Icon.external}
            </a>
          </div>
          <span className="small">
            <b>2.</b> Paste the code Claude shows after you sign in
          </span>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              sendCode();
            }}
          >
            <input
              className="input mono"
              style={{ flex: 1, minWidth: 0 }}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="Paste the code here"
              aria-label="Code from Claude"
              autoComplete="off"
            />
            <button type="submit" className="btn primary sm" disabled={!pasted.trim()}>
              Finish
            </button>
          </form>
        </div>
      )}

      {(phase === "sent" && tool === "claude") || phase === "checking" ? (
        <span className="row small muted">
          {Icon.spin} Checking the login…
        </span>
      ) : null}

      {phase === "failed" && (
        <div className="banner fail">
          <div className="grow small">
            <b>That did not work.</b> {prompt.error ? `${prompt.error} ` : ""}Try again, or use the terminal below. The output from the
            Pod is under “Details”.
          </div>
        </div>
      )}

      <div className="row between">
        {phase === "failed" || phase === "checking" ? (
          <button type="button" className="btn sm" onClick={() => void start()}>
            Try again
          </button>
        ) : (
          <button type="button" className="btn ghost sm" onClick={cancel}>
            Cancel
          </button>
        )}
        {output && (
          <details className="small faint">
            <summary>Details</summary>
            <pre className="outv mono">{stripAnsi(output).trim()}</pre>
          </details>
        )}
      </div>
    </div>
  );
}
