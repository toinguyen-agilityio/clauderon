"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useGatewaySocket } from "./gateway-socket";

const ShellSocket = createContext<WebSocket | null>(null);

/**
 * The one `/browser` socket of a tab (#198), opened by the shell for every page
 * and shared: the Needs you badge, notifications, the Run page and Build with
 * Agent all listen on it. Null while it is (re)connecting.
 */
export function ShellSocketProvider({ gatewayUrl, children }: { gatewayUrl: string; children: ReactNode }) {
  const socket = useGatewaySocket(gatewayUrl);
  return <ShellSocket.Provider value={socket}>{children}</ShellSocket.Provider>;
}

export function useShellSocket(): WebSocket | null {
  return useContext(ShellSocket);
}
