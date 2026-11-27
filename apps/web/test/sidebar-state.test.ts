import { describe, expect, it } from "vitest";
import { isToggleShortcut, parseCollapsed, SIDEBAR_COOKIE, serializeCollapsed } from "../src/components/sidebar-state";

const cookieValue = (cookie: string) => cookie.split(";")[0]!.split("=")[1];

describe("sidebar cookie", () => {
  it("round-trips both states", () => {
    for (const collapsed of [true, false]) expect(parseCollapsed(cookieValue(serializeCollapsed(collapsed)))).toBe(collapsed);
  });

  it("is site-wide, lasts a year and is named for the sidebar", () => {
    const cookie = serializeCollapsed(true);
    expect(cookie.startsWith(`${SIDEBAR_COOKIE}=collapsed;`)).toBe(true);
    expect(cookie).toContain("path=/");
    expect(cookie).toContain("max-age=31536000");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("defaults to expanded when missing or unknown", () => {
    expect(parseCollapsed(undefined)).toBe(false);
    expect(parseCollapsed("")).toBe(false);
    expect(parseCollapsed("yes")).toBe(false);
  });
});

describe("toggle shortcut", () => {
  const key = (overrides: Partial<Parameters<typeof isToggleShortcut>[0]> = {}) =>
    isToggleShortcut({ key: "b", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, target: { tagName: "BODY" } as unknown as EventTarget, ...overrides });

  it("accepts Ctrl+B and Cmd+B", () => {
    expect(key({ ctrlKey: true })).toBe(true);
    expect(key({ metaKey: true })).toBe(true);
    expect(key({ metaKey: true, key: "B" })).toBe(true);
  });

  it("ignores a plain b and other modifiers", () => {
    expect(key()).toBe(false);
    expect(key({ ctrlKey: true, shiftKey: true })).toBe(false);
    expect(key({ ctrlKey: true, altKey: true })).toBe(false);
    expect(key({ ctrlKey: true, key: "c" })).toBe(false);
  });

  it("ignores the shortcut while typing", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) expect(key({ ctrlKey: true, target: { tagName } as unknown as EventTarget })).toBe(false);
    expect(key({ ctrlKey: true, target: { tagName: "DIV", isContentEditable: true } as unknown as EventTarget })).toBe(false);
  });
});
