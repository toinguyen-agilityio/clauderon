"use client";

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
