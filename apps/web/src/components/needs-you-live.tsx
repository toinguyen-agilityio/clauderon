"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const LiveCount = createContext<number | null>(null);

/** The Needs you count the shell shows: the server's value at first, then `load` every `everyMs` while the tab is visible, with no page reload. */
export function NeedsYouProvider({ initial, load, everyMs = 15000, children }: { initial: number; load: () => Promise<number>; everyMs?: number; children: ReactNode }) {
  const [count, setCount] = useState(initial);
  useEffect(() => setCount(initial), [initial]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load().then(setCount, () => {});
    }, everyMs);
    return () => clearInterval(timer);
  }, [load, everyMs]);
  return <LiveCount.Provider value={count}>{children}</LiveCount.Provider>;
}

/** The live count when inside a provider, else the given one. */
export function useNeedsYou(fallback: number): number {
  return useContext(LiveCount) ?? fallback;
}
