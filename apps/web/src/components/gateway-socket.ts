"use client";

import { useEffect, useState } from "react";

/**
 * Opens a socket to the Gateway with a short-lived ticket from the web app
 * (spec M0 §7): the session cookie belongs to the web app's domain.
 */
export async function openGatewaySocket(gatewayUrl: string, path: "/browser" | "/terminal", params: Record<string, string> = {}): Promise<WebSocket | null> {
  const res = await fetch("/api/gateway-ticket", { cache: "no-store" });
  if (res.status === 401) {
    window.location.href = "/session-ended";
    return null;
  }
  if (!res.ok) return null;
  const { ticket } = (await res.json()) as { ticket: string };
  const query = new URLSearchParams({ ticket, ...params });
  return new WebSocket(`${gatewayUrl}${path}?${query}`);
}

/**
 * The Gateway's `/browser` socket, reopened with backoff when it drops (NFR-3);
 * open only while `enabled`.
 */
export function useGatewaySocket(gatewayUrl: string, enabled = true): WebSocket | null {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let current: WebSocket | null = null;
    let failures = 0;
    const open = async () => {
      const ws = await openGatewaySocket(gatewayUrl, "/browser");
      if (!ws) return;
      if (stopped) return ws.close();
      current = ws;
      ws.onopen = () => {
        failures = 0;
        setSocket(ws);
      };
      ws.onclose = (event) => {
        setSocket((s) => (s === ws ? null : s));
        if (stopped) return;
        if (event.code === 4403 || event.code === 4401) {
          window.location.href = "/session-ended";
          return;
        }
        retry = setTimeout(() => void open(), Math.min(1000 * 2 ** failures++, 10_000));
      };
    };
    void open();
    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      current?.close();
      setSocket(null);
    };
  }, [gatewayUrl, enabled]);
  return socket;
}
