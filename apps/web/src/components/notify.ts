import type { NotifyEvent, NotifyKind } from "@clauderon/protocol";

// Browser notifications for a Run's Starter (#198): what to show and where.
// Kept free of React and the DOM so it is tested directly.

export const NOTIFY_KEY = "clauderon-notifications";

/** The browser's permission, or "unsupported" where there is no Notification API. */
export type NotifyPermission = NotificationPermission | "unsupported";

export type Display = "os" | "toast" | "none";

/**
 * Where a `notify` shows. Nothing unless the switch is on and the browser
 * allows it. The focused, visible tab shows a toast; any other tab an OS
 * notification, whose tag lets the browser show only one across tabs.
 */
export function chooseDisplay(env: { enabled: boolean; permission: NotifyPermission; visibility: DocumentVisibilityState; focused: boolean }): Display {
  if (!env.enabled || env.permission !== "granted") return "none";
  return env.visibility === "visible" && env.focused ? "toast" : "os";
}

// Type-only import of the protocol: its runtime pulls in Node modules.
const KINDS: Record<NotifyKind, true> = {
  needs_human: true,
  succeeded: true,
  failed: true,
  interrupted: true,
  approved: true,
  rejected: true,
  answered: true,
  cancelled: true,
  retried: true,
};

/** A `notify` event from the socket's text, or null for any other message (or a kind this app does not know). */
export function parseNotify(text: string): NotifyEvent | null {
  let value: Record<string, unknown>;
  try {
    value = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (value?.type !== "notify" || typeof value.kind !== "string" || !Object.hasOwn(KINDS, value.kind)) return null;
  const strings = ["runId", "ticketKey", "ticketTitle", "flowName"] as const;
  if (!strings.every((k) => typeof value[k] === "string")) return null;
  const optional = (k: string) => (typeof value[k] === "string" ? (value[k] as string) : undefined);
  const request = value.request === "approve" || value.request === "grill" ? value.request : undefined;
  return {
    type: "notify",
    kind: value.kind as NotifyKind,
    runId: value.runId as string,
    ticketKey: value.ticketKey as string,
    ticketTitle: value.ticketTitle as string,
    flowName: value.flowName as string,
    ...(optional("nodeName") ? { nodeName: optional("nodeName") } : {}),
    ...(request ? { request } : {}),
    ...(optional("actor") ? { actor: optional("actor") } : {}),
  };
}

/** One tag per Run and kind: several tabs show one OS notification. */
export function notifyTag(event: Pick<NotifyEvent, "runId" | "kind">): string {
  return `run:${event.runId}:${event.kind}`;
}

const at = (node: string | undefined) => (node ? ` at “${node}”` : "");

/** The text of a notification, e.g. `repo#42 · Approve needed at “Review plan”`; plain text only. */
export function notifyText(event: NotifyEvent): { title: string; body: string } {
  const by = event.actor ?? "someone";
  const what = {
    needs_human: `${event.request === "grill" ? "Answers needed" : "Approve needed"}${at(event.nodeName)}`,
    succeeded: "Run succeeded",
    failed: `Run failed${at(event.nodeName)}`,
    interrupted: `Run interrupted${at(event.nodeName)}`,
    approved: `Approved by ${by}${at(event.nodeName)}`,
    rejected: `Rejected by ${by}${at(event.nodeName)}`,
    answered: `Answered by ${by}${at(event.nodeName)}`,
    cancelled: `Cancelled by ${by}`,
    retried: `Retried by ${by}${event.nodeName ? ` from “${event.nodeName}”` : ""}`,
  }[event.kind];
  return { title: `${event.ticketKey} · ${what}`, body: `${event.ticketTitle} — ${event.flowName}` };
}

/** The switch as stored in this browser; off by default. */
export function readEnabled(storage: Pick<Storage, "getItem"> | null): boolean {
  try {
    return storage?.getItem(NOTIFY_KEY) === "on";
  } catch {
    return false;
  }
}

/** The Projects page switch: whether it is on, whether it can be used, and why not. */
export function switchState(enabled: boolean, permission: NotifyPermission): { label: string; on: boolean; disabled: boolean; hint: string | null } {
  if (permission === "unsupported") return { label: "Notifications", on: false, disabled: true, hint: "This browser cannot show notifications." };
  if (permission === "denied") {
    return { label: "Notifications", on: false, disabled: true, hint: "Notifications are blocked for this site. Allow them in the browser's site settings, then reload." };
  }
  const on = enabled && permission === "granted";
  return { label: "Notifications", on, disabled: false, hint: null };
}
