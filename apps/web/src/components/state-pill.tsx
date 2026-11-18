// Pills for Run, Attempt and Node states and Ticket Statuses, and Output Type badges.

const RUN: Record<string, [tone: string, label: string]> = {
  queued: ["wait", "Queued"],
  running: ["run", "Running"],
  waiting_for_human: ["acc", "Waiting for you"],
  succeeded: ["ok", "Succeeded"],
  failed: ["fail", "Failed"],
  interrupted: ["intr", "Interrupted"],
  cancelled: ["", "Cancelled"],
  "not reached": ["", "Not reached"],
};

const TICKET: Record<string, string> = {
  Open: "plain",
  Queued: "wait",
  "In run": "run",
  "Needs you": "acc",
  Failed: "fail",
  Interrupted: "intr",
  "PR open": "acc",
  "PR merged": "ok",
  Closed: "",
};

const POD: Record<string, [tone: string, label: string]> = {
  creating: ["run", "Creating…"],
  running: ["ok", "Running"],
  stopped: ["", "Stopped"],
  error: ["fail", "Error"],
  deleting: ["run", "Deleting…"],
};

export function StatePill({ state }: { state: string }) {
  const [tone, label] = RUN[state] ?? ["", state];
  return <span className={`pill ${tone}`}>{label}</span>;
}

export function TicketStatusPill({ status }: { status: string }) {
  return <span className={`pill ${TICKET[status] ?? ""}`}>{status}</span>;
}

export function PodPill({ status }: { status: string }) {
  const [tone, label] = POD[status] ?? ["", status];
  return <span className={`pill ${tone}`}>{label}</span>;
}

const OUTPUT_COLOR: Record<string, string> = {
  issue: "--t-issue",
  plan: "--t-plan",
  branch: "--t-branch",
  "test-result": "--t-test",
  "pull-request": "--t-pr",
  summary: "--t-summary",
  screenshot: "--t-shot",
};

/** The CSS colour of an Output Type, for ports and edges on the Flow canvas. */
export const outputColor = (type: string) => `var(${OUTPUT_COLOR[type] ?? "--fg3"})`;

/** An Output Type with its colour, as on the Flow canvas. */
export function OType({ type, label }: { type: string; label?: string }) {
  return (
    <span className="otype" style={{ "--c": `var(${OUTPUT_COLOR[type] ?? "--fg3"})` } as React.CSSProperties}>
      <i />
      {label ?? type}
    </span>
  );
}
