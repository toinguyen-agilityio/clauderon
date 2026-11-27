// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { HelpIcon, TakeTourButton } from "../src/components/tour/help-icon";
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
  const startRun = vi.fn(async () => ({ ok: true as const, batchId: "b", runIds: ["r"] }));
  const view = render(
    <TourProvider isOperator={isOperator} loadFacts={loadFacts} startRun={startRun}>
      <nav>
        {["machines", "tickets", "flows", "runs", "pullRequests", "projects", "members"].map((a) => (
          <a key={a} href="#" data-tour-nav={a}>
            {a}
          </a>
        ))}
        <TakeTourButton />
      </nav>
      <main className="main">
        <div className="view" />
      </main>
    </TourProvider>,
  );
  return { ...view, loadFacts, startRun };
}

describe("guided tour", () => {
  it("starts for a new Member with the first step and its tooltip", async () => {
    mount();
    await waitFor(() => expect(popoverTitle()).toBe("Machines"));
    expect(progress()).toBe("Step 1 of 6");
  });

  it("starts without error when the saved value is corrupt", async () => {
    localStorage.setItem(TOUR_KEY, "{not json");
    mount();
    await waitFor(() => expect(popoverTitle()).toBe("Machines"));
  });

  it("does not show again after Skip, and remembers it", async () => {
    const first = mount();
    await waitFor(() => expect(popoverTitle()).toBe("Machines"));
    fireEvent.click(screen.getByText("Skip"));
    expect(saved().status).toBe("skipped");
    first.unmount();
    const second = mount();
    await quiet();
    expect(document.querySelector(".driver-popover")).toBeNull();
    expect(second.loadFacts).not.toHaveBeenCalled();
  });

  it("does not show again after finishing", async () => {
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

  it("goes Next to the next area's page", async () => {
    mount();
    await waitFor(() => expect(popoverTitle()).toBe("Machines"));
    fireEvent.click(document.querySelector(".driver-popover-next-btn")!);
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/tickets"));
  });

  it("Escape closes the tour, keeps the step, and returns focus", async () => {
    const outside = render(<button type="button">opener</button>);
    const opener = screen.getByText("opener");
    opener.focus();
    mount();
    await waitFor(() => expect(popoverTitle()).toBe("Machines"));
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await waitFor(() => expect(saved()).toMatchObject({ status: "inProgress", step: 0 }));
    expect(document.querySelector(".driver-popover")).toBeNull();
    expect(document.activeElement).toBe(opener);
    outside.unmount();
  });

  it("offers Resume or Restart to someone who left mid-tour", async () => {
    localStorage.setItem(TOUR_KEY, JSON.stringify({ status: "inProgress", step: 2 }));
    mount();
    fireEvent.click(await screen.findByText("Resume"));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/flows"));
    cleanup();
    nav.push.mockClear();
    mount();
    fireEvent.click(await screen.findByText("Restart"));
    await waitFor(() => expect(popoverTitle()).toBe("Machines"));
  });

  it("shows the Operator-only steps to an Operator and not to a Member", async () => {
    mount(facts({ isOperator: true }), true);
    await waitFor(() => expect(progress()).toBe("Step 1 of 8"));
    cleanup();
    localStorage.clear();
    mount(facts(), false);
    await waitFor(() => expect(progress()).toBe("Step 1 of 6"));
  });

  it("says what is missing and links to the fix instead of an empty area", async () => {
    nav.path = "/tickets";
    localStorage.setItem(TOUR_KEY, JSON.stringify({ status: "inProgress", step: 1 }));
    mount(facts({ tickets: [] }));
    fireEvent.click(await screen.findByText("Resume"));
    await waitFor(() => expect(popoverTitle()).toBe("No Ticket to pick yet"));
    fireEvent.click(screen.getByText("Go to Tickets"));
    expect(nav.push).toHaveBeenCalledWith("/tickets");
    expect(saved().status).toBe("inProgress");
  });

  it("never starts a Run on its own; the Member confirms", async () => {
    nav.path = "/tickets";
    localStorage.setItem(TOUR_KEY, JSON.stringify({ status: "inProgress", step: 3 }));
    const view = mount();
    fireEvent.click(await screen.findByText("Resume"));
    await waitFor(() => expect(popoverTitle()).toBe("Start a Run"));
    expect(view.startRun).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Start sample Run on o/r#1"));
    expect(view.startRun).toHaveBeenCalledWith({ flowId: "f1", ticketIds: ["t1"], extraInstructions: "" });
  });
});

describe("help icon", () => {
  const withTour = (ui: React.ReactNode) => (
    <TourProvider isOperator={false} loadFacts={async () => facts()} startRun={async () => ({ ok: false, error: "x" })}>
      {ui}
    </TourProvider>
  );

  beforeEach(() => localStorage.setItem(TOUR_KEY, JSON.stringify({ status: "finished", step: 0 })));

  it("shows the tooltip on focus and hover, and hides it on Escape", () => {
    render(withTour(<HelpIcon area="flows" />));
    const button = screen.getByRole("button", { name: /Flows/ });
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.focus(button);
    expect(screen.getByRole("tooltip").textContent).toContain("chain of steps");
    expect(button.getAttribute("aria-describedby")).toBe(screen.getByRole("tooltip").id);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.mouseEnter(button.parentElement!);
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });

  it("shows on tap", () => {
    render(withTour(<HelpIcon area="runs" />));
    fireEvent.click(screen.getByRole("button", { name: /Runs/ }));
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });
});
