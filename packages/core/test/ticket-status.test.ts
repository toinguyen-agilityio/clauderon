import { describe, expect, it } from "vitest";
import { ticketStatus, type RunForStatus } from "../src/index";

const open = { issueState: "open" as const };
const at = (n: number) => new Date(Date.UTC(2026, 10, 16, 0, n));
const real = (state: RunForStatus["state"], n: number, pullRequestState: RunForStatus["pullRequestState"] = null): RunForStatus => ({
  mode: "real",
  state,
  queuedAt: at(n),
  pullRequestState,
});

describe("ticketStatus", () => {
  it("T0-8: returns each of the nine statuses", () => {
    expect(ticketStatus({ issueState: "closed" }, [real("running", 1)])).toBe("Closed");
    expect(ticketStatus(open, [real("queued", 1)])).toBe("Queued");
    expect(ticketStatus(open, [real("running", 1)])).toBe("In run");
    expect(ticketStatus(open, [real("waiting_for_human", 1)])).toBe("Needs you");
    expect(ticketStatus(open, [real("failed", 1)])).toBe("Failed");
    expect(ticketStatus(open, [real("interrupted", 1)])).toBe("Interrupted");
    expect(ticketStatus(open, [real("succeeded", 1, "merged")])).toBe("PR merged");
    expect(ticketStatus(open, [real("succeeded", 1, "open")])).toBe("PR open");
    expect(ticketStatus(open, [])).toBe("Open");
  });

  it("T0-8: ignores Dry-run Runs", () => {
    expect(ticketStatus(open, [{ ...real("running", 1), mode: "dry" }])).toBe("Open");
  });

  it("an Active Run wins over an earlier pull request", () => {
    expect(ticketStatus(open, [real("succeeded", 1, "open"), real("running", 2)])).toBe("In run");
  });

  it("uses the latest Run with a pull request", () => {
    expect(ticketStatus(open, [real("succeeded", 2, "open"), real("cancelled", 1, "merged")])).toBe("PR open");
    expect(ticketStatus(open, [real("succeeded", 1, "open"), real("succeeded", 2, null)])).toBe("PR open");
  });

  it("a closed pull request is not shown", () => {
    expect(ticketStatus(open, [real("succeeded", 1, "closed")])).toBe("Open");
  });
});
