"use client";

import { useEffect } from "react";
import { LEAVE_MESSAGE, leavesPage } from "./unsaved";

/**
 * Asks before leaving while `unsaved` is true: closing or reloading the tab, clicking any link
 * to another page (breadcrumb, sidebar), and the browser Back button. Next.js has no built-in
 * navigation guard, so links are caught in the capture phase before Next's own handler runs.
 */
export function useLeaveGuard(unsaved: boolean) {
  useEffect(() => {
    if (!unsaved) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();

    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || !leavesPage(e, anchor, window.location)) return;
      if (window.confirm(LEAVE_MESSAGE)) return;
      e.preventDefault();
      e.stopPropagation();
    };

    // Back/Forward has already changed the URL when this fires. If the Member stays, step back
    // to the editor's entry and swallow the popstate that causes.
    let restoring = false;
    const onPopState = (e: PopStateEvent) => {
      if (restoring) {
        restoring = false;
        e.stopImmediatePropagation();
        return;
      }
      if (window.confirm(LEAVE_MESSAGE)) return;
      e.stopImmediatePropagation();
      restoring = true;
      window.history.go(1);
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
}
