"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useShellSocket } from "./shell-socket";

type Live = { count: number; changes: number };

const LiveNeeds = createContext<Live | null>(null);

/**
 * The Needs you count the shell shows: the server's value at first, then
 * `load` again on every `needs.changed` from the shell's `/browser` socket,
 * and every `everyMs` while the tab is visible as a fallback for when the
 * socket is down (or an older Gateway never sends the event).
 */
export function NeedsYouProvider({
  initial,
  load,
  everyMs = 15000,
  children,
}: {
  initial: number;
  load: () => Promise<number>;
  everyMs?: number;
  children: ReactNode;
}) {
  const [count, setCount] = useState(initial);
  const [changes, setChanges] = useState(0);
  const socket = useShellSocket();
  useEffect(() => setCount(initial), [initial]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load().then(setCount, () => {});
    }, everyMs);
    return () => clearInterval(timer);
  }, [load, everyMs]);
  useEffect(() => {
    if (!socket) return;
    const onMessage = (event: MessageEvent) => {
      const message = JSON.parse(String(event.data)) as { type: string };
      if (message.type !== "needs.changed") return;
      load().then(setCount, () => {});
      setChanges((n) => n + 1);
    };
    socket.addEventListener("message", onMessage);
    socket.send(JSON.stringify({ type: "subscribe.needs" }));
    return () => socket.removeEventListener("message", onMessage);
  }, [socket, load]);
  return <LiveNeeds.Provider value={{ count, changes }}>{children}</LiveNeeds.Provider>;
}

/** The live count when inside a provider, else the given one. */
export function useNeedsYou(fallback: number): number {
  return useContext(LiveNeeds)?.count ?? fallback;
}

/**
 * Refreshes the server-rendered Needs you list on each `needs.changed`. Rows
 * are keyed by request, so a form being filled in keeps its state.
 */
export function NeedsYouRefresh() {
  const router = useRouter();
  const changes = useContext(LiveNeeds)?.changes ?? 0;
  useEffect(() => {
    if (changes > 0) router.refresh();
  }, [changes, router]);
  return null;
}

/** A `<details>` that opens as `initialOpen` says, then stays as the Member leaves it across refreshes. */
export function KeepOpen({ initialOpen, className, children }: { initialOpen: boolean; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <details className={className} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      {children}
    </details>
  );
}
