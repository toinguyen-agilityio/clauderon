// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationsProvider, NotificationsToggle } from "../src/components/notifications-live";
import { NOTIFY_KEY } from "../src/components/notify";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../src/components/shell-socket", () => ({ useShellSocket: () => null }));

// A stand-in for the browser's Notification API: `answer` is what the permission prompt resolves to.
function fakeNotification(initial: NotificationPermission, answer: NotificationPermission) {
  const fake = {
    permission: initial,
    requestPermission: vi.fn(async () => {
      fake.permission = answer;
      return answer;
    }),
  };
  vi.stubGlobal("Notification", fake);
  return fake;
}

function renderToggle() {
  render(
    <NotificationsProvider>
      <NotificationsToggle />
    </NotificationsProvider>,
  );
  return screen.getByRole("switch") as HTMLInputElement;
}

async function click(input: HTMLInputElement) {
  await act(async () => {
    fireEvent.click(input);
  });
}

describe("the Notifications switch on Project Settings (#244)", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("asks on the click and stays on after Allow, also after a reload", async () => {
    const fake = fakeNotification("default", "granted");
    const input = renderToggle();
    expect(input.disabled).toBe(false);
    await click(input);
    expect(fake.requestPermission).toHaveBeenCalledTimes(1);
    expect(input.checked).toBe(true);
    expect(window.localStorage.getItem(NOTIFY_KEY)).toBe("on");
    expect(document.querySelector(".hint")).toBeNull();

    cleanup();
    expect(renderToggle().checked).toBe(true);
  });

  it("explains a blocked permission after Block", async () => {
    fakeNotification("default", "denied");
    const input = renderToggle();
    await click(input);
    expect(input.checked).toBe(false);
    expect(input.disabled).toBe(true);
    expect(screen.getByText(/blocked for this site/)).toBeTruthy();
  });

  it("explains why it stayed off when the prompt is dismissed or quietly blocked (still `default`)", async () => {
    fakeNotification("default", "default");
    const input = renderToggle();
    await click(input);
    expect(input.checked).toBe(false);
    expect(input.disabled).toBe(false);
    expect(screen.getByText(/did not allow notifications/)).toBeTruthy();
  });

  it("turns on and off when notifications were allowed in the site settings after the page loaded", async () => {
    const fake = fakeNotification("default", "default");
    const input = renderToggle();
    // Allowed from the address bar: no reload, no visibility change.
    fake.permission = "granted";
    await click(input);
    expect(fake.requestPermission).not.toHaveBeenCalled();
    expect(input.checked).toBe(true);
    expect(window.localStorage.getItem(NOTIFY_KEY)).toBe("on");
    await click(input);
    expect(input.checked).toBe(false);
    expect(window.localStorage.getItem(NOTIFY_KEY)).toBeNull();
  });

  it("turns on from a click on the drawn track, which sits above the hidden checkbox", async () => {
    fakeNotification("granted", "granted");
    const input = renderToggle();
    const track = input.nextElementSibling as HTMLElement;
    await act(async () => {
      fireEvent.click(track);
    });
    expect(input.checked).toBe(true);
  });

  it("explains an unsupported browser", () => {
    vi.stubGlobal("Notification", undefined);
    delete (window as { Notification?: unknown }).Notification;
    const input = renderToggle();
    expect(input.disabled).toBe(true);
    expect(screen.getByText(/cannot show notifications/)).toBeTruthy();
  });
});
