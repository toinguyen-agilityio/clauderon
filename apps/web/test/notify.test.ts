import { describe, expect, it } from "vitest";
import type { NotifyEvent } from "@clauderon/protocol";
import { NOTIFY_KEY, chooseDisplay, notifyTag, notifyText, parseNotify, readEnabled, switchState } from "../src/components/notify";

const event: NotifyEvent = { type: "notify", kind: "needs_human", runId: "r-1", ticketKey: "web#42", ticketTitle: "Fix totals", flowName: "Plan and deliver", nodeName: "Review plan", request: "approve" };

describe("chooseDisplay (#198)", () => {
  const on = { enabled: true, permission: "granted", visibility: "visible", focused: true } as const;

  it("shows a toast in the focused, visible tab", () => {
    expect(chooseDisplay(on)).toBe("toast");
  });

  it("shows an OS notification in a hidden tab, or a visible one without focus", () => {
    expect(chooseDisplay({ ...on, visibility: "hidden", focused: false })).toBe("os");
    expect(chooseDisplay({ ...on, focused: false })).toBe("os");
  });

  it("shows nothing with the switch off or without permission", () => {
    expect(chooseDisplay({ ...on, enabled: false })).toBe("none");
    expect(chooseDisplay({ ...on, visibility: "hidden", enabled: false })).toBe("none");
    for (const permission of ["default", "denied", "unsupported"] as const) {
      expect(chooseDisplay({ ...on, permission })).toBe("none");
      expect(chooseDisplay({ ...on, permission, visibility: "hidden" })).toBe("none");
    }
  });
});

describe("notifyText and notifyTag (#198)", () => {
  it("says what happened, with the Ticket key, the Node and who acted", () => {
    expect(notifyText(event)).toEqual({ title: "web#42 · Approve needed at “Review plan”", body: "Fix totals — Plan and deliver" });
    expect(notifyText({ ...event, request: "grill" }).title).toBe("web#42 · Answers needed at “Review plan”");
    expect(notifyText({ ...event, kind: "failed", nodeName: "Implement" }).title).toBe("web#42 · Run failed at “Implement”");
    expect(notifyText({ ...event, kind: "succeeded", nodeName: undefined }).title).toBe("web#42 · Run succeeded");
    expect(notifyText({ ...event, kind: "rejected", actor: "Jane" }).title).toBe("web#42 · Rejected by Jane at “Review plan”");
    expect(notifyText({ ...event, kind: "cancelled", actor: "Jane" }).title).toBe("web#42 · Cancelled by Jane");
    expect(notifyText({ ...event, kind: "retried", actor: "Jane" }).title).toBe("web#42 · Retried by Jane from “Review plan”");
  });

  it("tags by Run and kind, so several tabs show one OS notification", () => {
    expect(notifyTag(event)).toBe("run:r-1:needs_human");
  });
});

describe("parseNotify (#198)", () => {
  it("reads a notify event and ignores every other message", () => {
    expect(parseNotify(JSON.stringify(event))).toEqual(event);
    expect(parseNotify(JSON.stringify({ type: "needs.changed" }))).toBeNull();
    expect(parseNotify(JSON.stringify({ ...event, kind: "exploded" }))).toBeNull();
    expect(parseNotify(JSON.stringify({ ...event, runId: 1 }))).toBeNull();
    expect(parseNotify("not json")).toBeNull();
    expect(parseNotify("null")).toBeNull();
  });

  it("drops fields it does not know", () => {
    expect(parseNotify(JSON.stringify({ ...event, extra: "<b>x</b>" }))).toEqual(event);
  });
});

describe("the notifications switch (#198)", () => {
  const store = (value: string | null) => ({ getItem: (key: string) => (key === NOTIFY_KEY ? value : null) });

  it("is off unless this browser stored it on", () => {
    expect(readEnabled(store("on"))).toBe(true);
    expect(readEnabled(store(null))).toBe(false);
    expect(readEnabled(null)).toBe(false);
    expect(readEnabled({ getItem: () => { throw new Error("blocked"); } })).toBe(false);
  });

  it("offers to enable or disable, and explains a denied or unsupported permission", () => {
    expect(switchState(false, "default")).toMatchObject({ label: "Notifications", on: false, disabled: false, hint: null });
    expect(switchState(true, "granted")).toMatchObject({ label: "Notifications", on: true, disabled: false });
    expect(switchState(true, "default")).toMatchObject({ on: false });
    expect(switchState(true, "denied")).toMatchObject({ disabled: true, hint: expect.stringContaining("blocked") });
    expect(switchState(false, "unsupported")).toMatchObject({ disabled: true, hint: expect.stringContaining("cannot show") });
  });

  it("explains a prompt that ended without an answer, and only while the permission is still `default` (#244)", () => {
    expect(switchState(false, "default", true)).toMatchObject({ on: false, disabled: false, hint: expect.stringContaining("did not allow notifications") });
    expect(switchState(true, "granted", true)).toMatchObject({ on: true, hint: null });
    expect(switchState(false, "denied", true).hint).toContain("blocked for this site");
  });
});
