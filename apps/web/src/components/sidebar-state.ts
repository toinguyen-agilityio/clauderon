/** Cookie that remembers whether a Member collapsed the desktop sidebar (read by the server, so the first paint is right). */
export const SIDEBAR_COOKIE = "clauderon-sidebar";

export function parseCollapsed(value: string | undefined | null): boolean {
  return value === "collapsed";
}

/** A `document.cookie` assignment for the given state, kept for a year. */
export function serializeCollapsed(collapsed: boolean): string {
  return `${SIDEBAR_COOKIE}=${collapsed ? "collapsed" : "expanded"}; path=/; max-age=31536000; SameSite=Lax`;
}

/** Ctrl/Cmd+B toggles the sidebar, except while typing in a field. */
export function isToggleShortcut(event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean; target: EventTarget | null }): boolean {
  if (event.key.toLowerCase() !== "b" || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return false;
  const target = event.target as { tagName?: string; isContentEditable?: boolean } | null;
  if (!target) return true;
  if (target.isContentEditable) return false;
  return !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName ?? "");
}
