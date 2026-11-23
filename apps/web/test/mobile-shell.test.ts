import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/tickets" }));

import { MobileShell } from "../src/components/mobile-shell";

const html = (needsYou: number) => renderToStaticMarkup(createElement(MobileShell, { needsYou, children: createElement("nav", null, "links") }));

describe("MobileShell", () => {
  it("starts closed with a named, expandable menu button", () => {
    const out = html(0);
    expect(out).toContain('aria-label="Open menu"');
    expect(out).toContain('aria-expanded="false"');
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
