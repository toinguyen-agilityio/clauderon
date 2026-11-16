"use client";

import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";
import { openGatewaySocket } from "../../../../../components/gateway-socket";

/** xterm.js over the Gateway's `/terminal` socket; resize follows the window. */
export function Terminal({ gatewayUrl, podId }: { gatewayUrl: string; podId: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Connecting…");

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    void (async () => {
      const [{ Terminal: XTerm }, { FitAddon }] = await Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]);
      if (disposed || !host.current) return;
      const term = new XTerm({ cursorBlink: true, fontSize: 13, convertEol: false });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(host.current);
      fit.fit();

      const socket = await openGatewaySocket(gatewayUrl, "/terminal", { podId, cols: String(term.cols), rows: String(term.rows) });
      if (!socket || disposed) {
        socket?.close();
        term.dispose();
        return;
      }
      const send = (message: object) => socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify(message));
      socket.onopen = () => {
        setStatus("Connected");
        term.focus();
      };
      socket.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as { type: string; data?: string };
        if (message.type === "output" && message.data) term.write(message.data);
      };
      socket.onclose = (event) => {
        setStatus(event.code === 4403 ? "Your access was removed." : event.code === 4404 ? "Not found." : "Closed. Reload to open a new shell.");
        if (event.code === 4403) window.location.href = "/session-ended";
      };
      const input = term.onData((data) => send({ type: "input", data }));
      const onResize = () => {
        fit.fit();
        send({ type: "resize", cols: term.cols, rows: term.rows });
      };
      window.addEventListener("resize", onResize);
      cleanup = () => {
        window.removeEventListener("resize", onResize);
        input.dispose();
        socket.close();
        term.dispose();
      };
    })();
    return () => {
      disposed = true;
      cleanup();
    };
  }, [gatewayUrl, podId]);

  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="faint small">{status}</span>
      <div className="term">
        <div ref={host} />
      </div>
    </div>
  );
}
