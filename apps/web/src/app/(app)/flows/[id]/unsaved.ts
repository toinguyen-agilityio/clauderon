// When leaving the Flow editor needs a confirmation (issue #77). Kept free of React and the
// DOM so it is easy to test; use-leave-guard.ts wires it to clicks, Back and closing the tab.

export const LEAVE_MESSAGE = "You have unsaved changes to this Flow. Leave without saving?";

/** True while the editor holds edits that were not saved. A read-only Flow never has any. */
export function hasUnsavedChanges(s: { readOnly: boolean; graphChanged: boolean; name: string; savedName: string }): boolean {
  return !s.readOnly && (s.graphChanged || s.name.trim() !== s.savedName);
}

type ClickLike = { defaultPrevented: boolean; button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean };
type AnchorLike = { href: string; target: string; hasAttribute(name: string): boolean };

/**
 * Whether clicking this link would leave the current page: a plain left click on a link to
 * another page of this site. Hash-only links, new-tab clicks, downloads and other sites are
 * not (another site is covered by the browser's own prompt when the tab unloads).
 */
export function leavesPage(click: ClickLike, anchor: AnchorLike, current: { origin: string; pathname: string; search: string }): boolean {
  if (click.defaultPrevented || click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;
  if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return false;
  let url: URL;
  try {
    url = new URL(anchor.href, current.origin);
  } catch {
    return false;
  }
  if (url.origin !== current.origin) return false;
  return url.pathname !== current.pathname || url.search !== current.search;
}
