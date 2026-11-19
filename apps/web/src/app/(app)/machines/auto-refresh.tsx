"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Reloads the page's data on an interval, e.g. while a Machine is being paired. */
export function AutoRefresh({ everyMs }: { everyMs: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, everyMs);
    return () => clearInterval(timer);
  }, [router, everyMs]);
  return null;
}
