"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { NotifyEvent } from "@clauderon/protocol";
import { Icon } from "./icons";
import { NOTIFY_KEY, chooseDisplay, notifyTag, notifyText, parseNotify, readEnabled, switchState, type NotifyPermission } from "./notify";
import { useShellSocket } from "./shell-socket";

type Toast = { id: number; runId: string; title: string; body: string };
type Setting = { enabled: boolean; permission: NotifyPermission; unanswered: boolean; toggle: () => void };

const NotifySetting = createContext<Setting | null>(null);
const TOAST_MS = 10_000;

function currentPermission(): NotifyPermission {
  return typeof window === "undefined" || !("Notification" in window) ? "unsupported" : Notification.permission;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Notifications for a Run's Starter (#198), while a tab is open: listens for
 * `notify` on the shell's socket and shows an OS notification or, in the
 * focused tab, a toast. Off until the Member turns it on in this browser.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const socket = useShellSocket();
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotifyPermission>("default");
  // The last prompt from the switch ended still `default` (dismissed or quietly blocked).
  const [unanswered, setUnanswered] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  // Read by the socket listener, which is not re-attached when these change.
  const setting = useRef({ enabled, permission });
  setting.current = { enabled, permission };

  // The permission can change in the browser's site settings: read it again when the tab comes back.
  useEffect(() => {
    const read = () => {
      setEnabled(readEnabled(storage()));
      setPermission(currentPermission());
    };
    read();
    document.addEventListener("visibilitychange", read);
    return () => document.removeEventListener("visibilitychange", read);
  }, []);

  const open = useCallback(
    (runId: string) => {
      window.focus();
      router.push(`/runs/${encodeURIComponent(runId)}`);
    },
    [router],
  );

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (event: NotifyEvent) => {
      const display = chooseDisplay({ ...setting.current, visibility: document.visibilityState, focused: document.hasFocus() });
      if (display === "none") return;
      const { title, body } = notifyText(event);
      if (display === "os") {
        try {
          const notification = new Notification(title, { body, tag: notifyTag(event) });
          notification.onclick = () => {
            open(event.runId);
            notification.close();
          };
        } catch {
          // Some browsers allow notifications only from a service worker: nothing is shown.
        }
        return;
      }
      const id = nextId.current++;
      setToasts((all) => [...all.slice(-3), { id, runId: event.runId, title, body }]);
      setTimeout(() => dismiss(id), TOAST_MS);
    },
    [open, dismiss],
  );

  useEffect(() => {
    if (!socket) return;
    const onMessage = (message: MessageEvent) => {
      const event = parseNotify(String(message.data));
      if (event) show(event);
    };
    socket.addEventListener("message", onMessage);
    return () => socket.removeEventListener("message", onMessage);
  }, [socket, show]);

  const toggle = useCallback(() => {
    const save = (on: boolean) => {
      setEnabled(on);
      try {
        if (on) storage()?.setItem(NOTIFY_KEY, "on");
        else storage()?.removeItem(NOTIFY_KEY);
      } catch {
        // storage unavailable: the choice lasts for this page only
      }
    };
    // Read the permission again: it may have been allowed in the site settings since the page loaded.
    const now = currentPermission();
    setPermission(now);
    if (now === "unsupported" || now === "denied") return;
    if (enabled && now === "granted") return save(false);
    if (now === "granted") return save(true);
    // Asked only from this click (#198). A dismissed or quietly blocked prompt
    // resolves `default` (or rejects): keep the switch off and say why (#244).
    Promise.resolve()
      .then(() => Notification.requestPermission())
      .catch(() => currentPermission())
      .then((answer) => {
        setPermission(answer);
        setUnanswered(answer === "default");
        save(answer === "granted");
      });
  }, [enabled]);

  return (
    <NotifySetting.Provider value={{ enabled, permission, unanswered, toggle }}>
      {children}
      {toasts.length > 0 && (
        <div className="notify-toasts" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="notify-toast">
              <button
                type="button"
                className="notify-toast-open"
                onClick={() => {
                  dismiss(t.id);
                  open(t.runId);
                }}
              >
                {/* Ticket and Node text is rendered as plain text, never as HTML. */}
                <strong>{t.title}</strong>
                <span className="small faint">{t.body}</span>
              </button>
              <button type="button" className="icon-btn" aria-label="Dismiss" title="Dismiss" onClick={() => dismiss(t.id)}>
                {Icon.close}
              </button>
            </div>
          ))}
        </div>
      )}
    </NotifySetting.Provider>
  );
}

/** The Projects page card whose switch turns notifications on and off for this browser. */
export function NotificationsToggle() {
  const setting = useContext(NotifySetting);
  if (!setting) return null;
  const state = switchState(setting.enabled, setting.permission, setting.unanswered);
  return (
    <section className="card notify-card" aria-labelledby="notify-card-h">
      <div className="notify-card-head">
        <h2 id="notify-card-h">{state.label}</h2>
        <span className="fe-switch">
          <input type="checkbox" role="switch" aria-labelledby="notify-card-h" checked={state.on} disabled={state.disabled} onChange={setting.toggle} />
          <span aria-hidden="true" />
        </span>
      </div>
      <p className="small muted">
        Get a notification when one of your Runs needs you at an Approve or Grill Node, when it ends, or when someone else approves, rejects, answers,
        cancels or retries it. It works while an app tab is open, and applies to this browser only.
      </p>
      {state.hint && <p className="hint">{state.hint}</p>}
    </section>
  );
}
