"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Brand } from "./brand";
import { Icon } from "./icons";
import { useNeedsYou } from "./needs-you-live";
import { isToggleShortcut, serializeCollapsed } from "./sidebar-state";

const MOBILE_QUERY = "(max-width: 860px)";

/**
 * The left rail. On desktop it is the sticky sidebar; on phone widths it becomes a
 * drawer opened from a top bar with a menu button (the CSS does the switch).
 * On desktop it can collapse to an icon-only rail; `collapsed` comes from a cookie
 * the server reads, so the first paint already has the remembered state.
 */
export function MobileShell({ needsYou: initial, collapsed: initialCollapsed = false, children }: { needsYou: number; collapsed?: boolean; children: ReactNode }) {
  const needsYou = useNeedsYou(initial);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const path = usePathname();
  const menuRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sideRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);

  // Choosing a nav item changes the route.
  useEffect(() => setOpen(false), [path]);

  // Writing the same value twice (StrictMode) is harmless.
  const toggleCollapsed = useCallback(
    () =>
      setCollapsed((was) => {
        document.cookie = serializeCollapsed(!was);
        return !was;
      }),
    [],
  );

  // Ctrl/Cmd+B on desktop only; the phone drawer keeps its own menu button.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isToggleShortcut(event) || window.matchMedia(MOBILE_QUERY).matches) return;
      event.preventDefault();
      toggleCollapsed();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggleCollapsed]);

  useEffect(() => {
    if (open) closeRef.current?.focus();
    else if (wasOpen.current) menuRef.current?.focus();
    wasOpen.current = open;
    if (!open) return;

    const body = document.body;
    const previous = body.style.overflow;
    body.style.overflow = "hidden";
    const media = window.matchMedia(MOBILE_QUERY);
    const onMedia = () => {
      if (!media.matches) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") return setOpen(false);
      if (event.key !== "Tab" || !sideRef.current) return;
      const focusable = sideRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    media.addEventListener("change", onMedia);
    document.addEventListener("keydown", onKey);
    return () => {
      body.style.overflow = previous;
      media.removeEventListener("change", onMedia);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header className="topbar">
        <Brand />
        <button
          ref={menuRef}
          type="button"
          className="menu-btn"
          aria-label={needsYou ? `Open menu, ${needsYou} waiting` : "Open menu"}
          aria-expanded={open}
          aria-controls="side-drawer"
          onClick={() => setOpen(true)}
        >
          {Icon.menu}
          {needsYou ? <span className="dot" aria-hidden="true" /> : null}
        </button>
      </header>
      {open ? <div className="scrim" aria-hidden="true" onClick={() => setOpen(false)} /> : null}
      <aside id="side-drawer" ref={sideRef} className={["side", open && "open", collapsed && "collapsed"].filter(Boolean).join(" ")}>
        <button
          type="button"
          className="side-toggle"
          aria-label={collapsed ? (needsYou ? `Expand sidebar, ${needsYou} waiting` : "Expand sidebar") : "Collapse sidebar"}
          aria-expanded={!collapsed}
          aria-controls="side-drawer"
          title={collapsed ? "Expand sidebar (Ctrl/Cmd+B)" : "Collapse sidebar (Ctrl/Cmd+B)"}
          onClick={toggleCollapsed}
        >
          {Icon.sidebar}
          {collapsed && needsYou ? <span className="dot" aria-hidden="true" /> : null}
        </button>
        <button ref={closeRef} type="button" className="side-close" aria-label="Close menu" onClick={() => setOpen(false)}>
          {Icon.close}
        </button>
        {children}
      </aside>
    </>
  );
}
