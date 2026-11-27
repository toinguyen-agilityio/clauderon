import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/tickets" }));

import { MobileShell } from "../src/components/mobile-shell";

const html = (needsYou: number, collapsed?: boolean) =>
  renderToStaticMarkup(createElement(MobileShell, { needsYou, collapsed, children: createElement("nav", null, "links") }));

describe("MobileShell", () => {
  it("starts closed with a named, expandable menu button", () => {
    const out = html(0);
    expect(out).toContain('aria-label="Open menu"');
    expect(out).toMatch(/class="menu-btn"[^>]*aria-expanded="false"/);
    expect(out).toContain('aria-controls="side-drawer"');
    expect(out).toContain('<aside id="side-drawer" class="side">');
    expect(out).not.toContain("scrim");
  });

  it("keeps the sidebar content and a close button in the drawer", () => {
    const out = html(0);
    expect(out).toContain("links");
    expect(out).toContain('aria-label="Close menu"');
  });

  it("flags waiting requests on the menu button", () => {
    const out = html(3);
    expect(out).toContain("Open menu, 3 waiting");
    expect(out).toContain('class="dot"');
  });
});

describe("desktop sidebar toggle", () => {
  const toggle = (out: string) => out.match(/<button[^>]*class="side-toggle"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";

  it("starts expanded by default with a collapse button", () => {
    const button = toggle(html(0));
    expect(button).toContain('aria-label="Collapse sidebar"');
    expect(button).toContain('aria-expanded="true"');
    expect(button).toContain('aria-controls="side-drawer"');
    expect(button).toContain("<svg");
  });

  it("renders the remembered collapsed state as a rail with an expand button", () => {
    const out = html(0, true);
    expect(out).toContain('<aside id="side-drawer" class="side collapsed">');
    expect(toggle(out)).toContain('aria-label="Expand sidebar"');
    expect(toggle(out)).toContain('aria-expanded="false"');
    expect(toggle(out)).not.toContain('class="dot"');
  });

  it("keeps the Needs you count on the toggle while collapsed", () => {
    const button = toggle(html(4, true));
    expect(button).toContain('aria-label="Expand sidebar, 4 waiting"');
    expect(button).toContain('class="dot"');
  });

  it("leaves the phone drawer button and close button as they were", () => {
    const out = html(2, true);
    expect(out).toContain("Open menu, 2 waiting");
    expect(out).toContain('aria-label="Close menu"');
    expect(out).not.toContain("scrim");
  });
});

describe("mobile drawer nav styles", () => {
  const css = readFileSync(join(__dirname, "../src/app/globals.css"), "utf8");
  const mobileBlocks = [...css.matchAll(/@media \(max-width: 860px\) \{([\s\S]*?)\n\}/g)].map((m) => m[1]).join("\n");

  it("does not lay nav groups out in a row or hide their titles on phones", () => {
    expect(mobileBlocks).not.toMatch(/\.nav-group\s*\{[^}]*flex-direction:\s*row/);
    expect(mobileBlocks).not.toMatch(/\.nav-group-title\s*\{[^}]*display:\s*none/);
  });

  it("hides the desktop toggle on phones and keeps rail rules out of the drawer", () => {
    expect(mobileBlocks).toMatch(/\.side-toggle \{ display: none; \}/);
    expect(mobileBlocks).not.toContain(".side.collapsed");
  });

  it("styles the collapsed rail only on desktop widths", () => {
    const desktopBlocks = [...css.matchAll(/@media \(min-width: 861px\) \{([\s\S]*?)\n\}/g)].map((m) => m[1]).join("\n");
    expect(desktopBlocks).toMatch(/\.side\.collapsed \{[^}]*width: 64px/);
    const outside = css.replace(/@media \(min-width: 861px\) \{[\s\S]*?\n\}/g, "");
    expect(outside).not.toContain(".side.collapsed");
    // the rail hides labels by clipping, so links keep their accessible name
    expect(desktopBlocks).not.toMatch(/\.lbl \{[^}]*display: none/);
  });

  it("only scrolls the drawer vertically", () => {
    expect(mobileBlocks).toMatch(/\.side \{[^}]*overflow-x: hidden; overflow-y: auto/);
  });
});
