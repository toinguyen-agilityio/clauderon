// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TakeTourButton } from "../src/components/tour/take-tour-button";
import { TOUR_KEY } from "../src/components/tour/storage";
import { TourProvider } from "../src/components/tour/tour-provider";
import type { TourFacts } from "../src/server/tour";

const nav = vi.hoisted(() => ({ path: "/machines", push: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path, useRouter: () => ({ push: nav.push }) }));

const facts = (over: Partial<TourFacts> = {}): TourFacts => ({
  isOperator: false,
  machines: 1,
  tickets: [{ id: "t1", key: "o/r#1", title: "First" }],
  flows: [{ id: "f1", name: "Flow" }],
  runs: 1,
  firstRunId: "r1",
  pullRequests: 0,
  ...over,
});

beforeAll(() => {
  // jsdom has no layout: say every element is on screen, and stub what driver.js calls.
  Element.prototype.getClientRects = () => [{}] as unknown as DOMRectList;
  Element.prototype.scrollIntoView = () => {};
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
});

beforeEach(() => {
  localStorage.clear();
  nav.path = "/machines";
  nav.push.mockClear();
});
afterEach(() => cleanup());

const popoverTitle = () => document.querySelector(".driver-popover-title")?.textContent;
const progress = () => document.querySelector(".driver-popover-progress-text")?.textContent;
const saved = () => JSON.parse(localStorage.getItem(TOUR_KEY) ?? "null");
const quiet = () => new Promise((r) => setTimeout(r, 150));

function mount(f: TourFacts = facts(), isOperator = false) {
  const loadFacts = vi.fn(async () => f);
  const tree = () => (
    <TourProvider isOperator={isOperator} loadFacts={loadFacts}>
      <nav>
        {["machines", "tickets", "flows", "runs", "pullRequests", "projects", "members"].map((a) => (
          <a key={a} href="#" data-tour-nav={a}>
            {a}
          </a>
        ))}
        <TakeTourButton />
      </nav>
      <main className="main">
        <section className="mach-pair">
          <div className="mach-cmds" />
        </section>
        <input id="gh-token" />
        <div className="view">
          <table className="tk-table">
            <tbody>
              <tr>
                <td>
                  <input type="checkbox" className="cb" aria-label="Select o/r#1" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </TourProvider>
  );
  const view = render(tree());
  // The router mock does not move the page, so a step's route is followed by hand.
  const next = async () => {
    const before = nav.push.mock.calls.length;
    fireEvent.click(await screen.findByText("Next"));
    await waitFor(() => expect(nav.push.mock.calls.length).toBeGreaterThan(before));
    nav.path = nav.push.mock.calls.at(-1)![0];
    view.rerender(tree());
  };
  return { ...view, loadFacts, next };
}

const takeTour = () => fireEvent.click(screen.getByText("Take the tour"));

describe("guided tour", () => {
  it("does not start on its own, not even for a new Member", async () => {
    const view = mount();
    await quiet();
    expect(document.querySelector(".driver-popover")).toBeNull();
    expect(view.loadFacts).not.toHaveBeenCalled();
  });

  it("Take the tour opens the first step with its tooltip and buttons", async () => {
    mount();
    takeTour();
    await waitFor(() => expect(popoverTitle()).toBe("Machines"));
    expect(progress()).toBe("Step 1 of 6");
    expect(document.querySelector(".driver-popover-next-btn")).not.toBeNull();
    expect(document.querySelector(".driver-popover-close-btn")).not.toBeNull();
  });

  it("starts without error when the saved value is corrupt", async () => {
    localStorage.setItem(TOUR_KEY, "{not json");
    mount();
    takeTour();
    await waitFor(() => expect(popoverTitle()).toBe("Machines"));
  });

  it("Skip closes the tour and remembers it", async () => {
    const first = mount();
    takeTour();
    await waitFor(() => expect(popoverTitle()).toBe("Machines"));
    fireEvent.click(screen.getByText("Skip"));
    expect(saved().status).toBe("skipped");
    first.unmount();
    const second = mount();
    await quiet();
    expect(document.querySelector(".driver-popover")).toBeNull();
    expect(second.loadFacts).not.toHaveBeenCalled();
  });

  it("stays closed after finishing", async () => {
    localStorage.setItem(TOUR_KEY, JSON.stringify({ status: "finished", step: 5 }));
    const view = mount();
    await quiet();
    expect(document.querySelector(".driver-popover")).toBeNull();
    expect(view.loadFacts).not.toHaveBeenCalled();
  });

  it("reopens from Take the tour after a skip", async () => {
    localStorage.setItem(TOUR_KEY, JSON.stringify({ status: "skipped", step: 0 }));
    mount();
    fireEvent.click(screen.getByText("Take the tour"));
    await waitFor(() => expect(popoverTitle()).toBe("Machines"));
  });

  it("shows Take the tour in the saved language, and switching language changes it at once", async () => {
    localStorage.setItem(TOUR_KEY, JSON.stringify({ status: "skipped", step: 0, lang: "vi" }));
    mount();
    expect(await screen.findByText("Xem hướng dẫn")).toBeTruthy();
    cleanup();
    localStorage.clear();
    mount();
    takeTour();
    await waitFor(() => expect(popoverTitle()).toBe("Machines"));
    fireEvent.click(screen.getByText("Tiếng Việt"));
    expect(await screen.findByText("Xem hướng dẫn")).toBeTruthy();
    expect(saved().lang).toBe("vi");
  });

  it("goes Next to the next area's page", async () => {
    mount();
    takeTour();
    await waitFor(() => expect(popoverTitle()).toBe("Machines"));
    fireEvent.click(document.querySelector(".driver-popover-next-btn")!);
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/tickets"));
  });

  it("Escape closes the tour, keeps the step, and returns focus", async () => {
    const outside = render(<button type="button">opener</button>);
    const opener = screen.getByText("opener");
    opener.focus();
    mount();
    takeTour();
    await waitFor(() => expect(popoverTitle()).toBe("Machines"));
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await waitFor(() => expect(saved()).toMatchObject({ status: "inProgress", step: 0 }));
    expect(document.querySelector(".driver-popover")).toBeNull();
    expect(document.activeElement).toBe(opener);
    outside.unmount();
  });

  it("shows the Operator-only steps to an Operator and not to a Member", async () => {
    mount(facts({ isOperator: true }), true);
    takeTour();
    await waitFor(() => expect(progress()).toBe("Step 1 of 8"));
    cleanup();
    localStorage.clear();
    mount(facts(), false);
    takeTour();
    await waitFor(() => expect(progress()).toBe("Step 1 of 6"));
  });

  it("says what is missing and links to the fix instead of an empty area", async () => {
    const view = mount(facts({ tickets: [] }));
    takeTour();
    await waitFor(() => expect(popoverTitle()).toBe("Machines"));
    await view.next();
    await waitFor(() => expect(popoverTitle()).toBe("No Ticket to pick yet"));
    fireEvent.click(screen.getByText("Go to Tickets"));
    expect(nav.push).toHaveBeenCalledWith("/tickets");
    expect(saved().status).toBe("inProgress");
  });

  it("Start a Run points at the first Ticket checkbox and leaves picking and starting to the Member", async () => {
    const view = mount();
    takeTour();
    await waitFor(() => expect(popoverTitle()).toBe("Machines"));
    for (let i = 0; i < 3; i++) await view.next();
    await waitFor(() => expect(popoverTitle()).toBe("Start a Run"));
    expect(document.querySelector(".driver-active-element")).toBe(document.querySelector(".tk-table .cb"));
    expect(document.querySelector(".driver-popover select, .driver-popover .tour-start")).toBeNull();
    expect(document.querySelector(".driver-popover-description")?.textContent).toContain("Start Runs");
  });
});
