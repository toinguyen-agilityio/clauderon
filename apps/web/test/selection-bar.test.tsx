// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/tickets", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("../src/app/(app)/tickets/actions", () => ({ loadStartDialog: vi.fn(), startAction: vi.fn() }));
vi.mock("../src/app/(app)/pull-requests/actions", () => ({ loadPullRequestStartDialog: vi.fn(), startPullRequestsAction: vi.fn() }));

import { PullRequestTable, type PullRequestListRow } from "../src/app/(app)/pull-requests/pull-request-table";
import { TicketTable } from "../src/app/(app)/tickets/ticket-table";
import type { TicketRow } from "../src/server/tickets";

afterEach(cleanup);

const LONG = 60;

const tickets: TicketRow[] = Array.from({ length: LONG }, (_, i) => ({
  id: `t${i}`,
  projectId: "p1",
  number: i + 1,
  key: `o/r#${i + 1}`,
  title: `Ticket ${i + 1}`,
  labels: [],
  url: `https://github.com/o/r/issues/${i + 1}`,
  authorAssociation: "MEMBER",
  status: "Open",
  activeRunId: null,
  activeRunState: null,
  latestRun: null,
}));

const pulls: PullRequestListRow[] = Array.from({ length: LONG }, (_, i) => ({
  id: `p1:${i + 1}`,
  projectId: "p1",
  repo: "o/r",
  number: i + 1,
  url: `https://github.com/o/r/pull/${i + 1}`,
  title: `Pull ${i + 1}`,
  branch: `b${i + 1}`,
  authorLogin: "someone",
  needsYou: false,
  openedBy: null,
  run: null,
  ago: "1h",
}));

describe.each([
  ["Tickets", () => render(<TicketTable rows={tickets} searched={false} view="Open" />), "Select o/r#1", "1 Ticket selected"],
  ["Pull requests", () => render(<PullRequestTable rows={pulls} empty="None" />), undefined, "1 pull request selected"],
])("the %s selection bar", (_, mount, firstBox, text) => {
  it("shows when the first row of a long list is ticked, and goes when cleared", () => {
    mount();
    expect(screen.queryByRole("region", { name: "Selection" })).toBeNull();

    const box = firstBox ? screen.getByRole("checkbox", { name: firstBox }) : screen.getAllByRole("checkbox")[1]!;
    fireEvent.click(box);

    const bar = screen.getByRole("region", { name: "Selection" });
    expect(bar.className).toBe("selbar");
    expect(bar.textContent).toContain(text);
    expect(screen.getByRole("button", { name: /Start Runs/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByRole("region", { name: "Selection" })).toBeNull();
  });
});

describe("selection bar styles", () => {
  const css = readFileSync(join(__dirname, "../src/app/globals.css"), "utf8");
  // Top-level rules start a line; rules inside the phone block are indented.
  const rule = (scope: string, selector: string) => {
    const m = scope.match(new RegExp(`\\n${scope === css ? "" : "\\s+"}${selector.replace(/[.()]/g, "\\$&")} \\{([^}]*)\\}`));
    return m?.[1] ?? "";
  };
  const phone = [...css.matchAll(/@media \(max-width: 860px\) \{([\s\S]*?)\n\}/g)].map((m) => m[1]).join("\n");
  const zOf = (scope: string, selector: string) => Number(rule(scope, selector).match(/z-index: (\d+)/)?.[1]);

  it("pins the bar to the bottom of the viewport, not the list", () => {
    const bar = rule(css, ".selbar");
    expect(bar).toContain("position: fixed");
    expect(bar).toMatch(/bottom: max\(16px, env\(safe-area-inset-bottom/);
    expect(bar).not.toContain("sticky");
  });

  it("is not trapped by an entrance animation that keeps a transform on its ancestors", () => {
    expect(css).toMatch(/\.view > \*, \.pod-grid > \*, \.stats > \* \{ animation: rise [^;]*backwards;/);
  });

  it("goes full width on phones and leaves room to scroll past it", () => {
    // The phone override must come after the base rule, or the base left inset wins the cascade.
    const phoneBar = css.search(/\n\s+\.selbar \{ left: max\(12px[^;]*;\s*right: max\(12px/);
    expect(phoneBar).toBeGreaterThan(css.search(/\n\.selbar \{/));
    expect(rule(phone, ".selbar")).toContain("flex-wrap: nowrap");
    expect(rule(phone, ".main:has(.selbar)")).toMatch(/padding-bottom: \d+px/);
  });

  it("sits under the phone topbar, scrim and menu drawer", () => {
    const z = zOf(css, ".selbar");
    expect(z).toBeGreaterThan(0);
    for (const sel of [".topbar", ".scrim", ".side"]) expect(z).toBeLessThan(zOf(phone, sel));
  });
});
