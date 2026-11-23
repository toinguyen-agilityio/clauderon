import { isActive, type RunState } from "./run";

export type TicketStatus =
  | "Closed"
  | "Queued"
  | "In run"
  | "Needs you"
  | "Failed"
  | "Interrupted"
  | "PR merged"
  | "PR open"
  | "Open";

export type PullRequestState = "open" | "merged" | "closed";

export type RunForStatus = {
  state: RunState;
  queuedAt: Date;
  pullRequestState: PullRequestState | null;
};

const ACTIVE_STATUS: Partial<Record<RunState, TicketStatus>> = {
  queued: "Queued",
  running: "In run",
  waiting_for_human: "Needs you",
  failed: "Failed",
  interrupted: "Interrupted",
};

/**
 * A Ticket's Status is derived, never stored (TIC-6). First match wins:
 * closed issue, the Active Run's state, the latest pull request, then Open.
 */
export function ticketStatus(ticket: { issueState: "open" | "closed" }, runs: readonly RunForStatus[]): TicketStatus {
  if (ticket.issueState === "closed") return "Closed";

  const real = [...runs].sort((a, b) => b.queuedAt.getTime() - a.queuedAt.getTime());
  const active = real.find((r) => isActive(r.state));
  if (active) return ACTIVE_STATUS[active.state] ?? "Open";

  const withPullRequest = real.find((r) => r.pullRequestState !== null);
  if (withPullRequest?.pullRequestState === "merged") return "PR merged";
  if (withPullRequest?.pullRequestState === "open") return "PR open";
  return "Open";
}
