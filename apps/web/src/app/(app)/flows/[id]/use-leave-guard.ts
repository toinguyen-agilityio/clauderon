"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { leavesPage } from "./unsaved";

/** What the Member was trying to do when the guard stopped them. */
export type PendingLeave = { kind: "link"; href: string } | { kind: "back" };

/**
 * Stops the Member from leaving while `unsaved` is true and reports what they tried in
 * `pending`, for the page to ask in its own dialog (`stay` or `leave` answers it). It stops a
 * click on any link to another page (breadcrumb, sidebar) and the browser Back button. Next.js
 * has no built-in navigation guard, so links are caught in the capture phase before Next's
 * handler runs. Closing or reloading the tab cannot use a dialog of ours: the browser's own
 * prompt is the only option there.
 */
export function useLeaveGuard(unsaved: boolean) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingLeave | null>(null);
  // Set once the Member agreed to leave, so the guard lets that one move through.
  const allowed = useRef(false);

  useEffect(() => {
    if (!unsaved) return;
    allowed.current = false;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!allowed.current) e.preventDefault();
    };

    const onClick = (e: MouseEvent) => {
      if (allowed.current) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || !leavesPage(e, anchor, window.location)) return;
      e.preventDefault();
      e.stopPropagation();
      setPending({ kind: "link", href: anchor.href });
    };

    // Back/Forward has already changed the URL when this fires: step back to the editor's
    // entry, swallow the popstate that causes, and ask.
    let restoring = false;
    const onPopState = (e: PopStateEvent) => {
      if (allowed.current) return;
      e.stopImmediatePropagation();
      if (restoring) {
        restoring = false;
        return;
      }
      restoring = true;
      window.history.go(1);
      setPending({ kind: "back" });
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState, true);
    };
  }, [unsaved]);

  const stay = () => setPending(null);
  const leave = () => {
    const target = pending;
    allowed.current = true;
    setPending(null);
    if (target?.kind === "link") router.push(target.href);
    else if (target?.kind === "back") window.history.back();
  };

  return { pending, stay, leave };
}
