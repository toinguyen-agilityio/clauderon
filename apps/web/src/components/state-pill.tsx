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
  Open: "ok",
  Queued: "wait",
  "In run": "run",
  "Needs you": "acc",
  Failed: "fail",
  Interrupted: "intr",
  "PR open": "acc",
  "PR merged": "ok",
  Closed: "",
};

/** A Run state's tone (pill class) and label, for places that show it without a pill. */
export const runStateLook = (state: string) => RUN[state] ?? ["", state];

/** A Ticket Status's tone (pill class). */
export const ticketTone = (status: string) => TICKET[status] ?? "";

const TAG_COLORS = ["--t-branch", "--t-plan", "--t-shot", "--t-summary", "--t-pr", "--intr", "--t-test"];

/** A stable colour for a name (a label, a repository), so the same name always gets the same colour. */
export function tagColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return `var(${TAG_COLORS[Math.abs(h) % TAG_COLORS.length]})`;
}

export function StatePill({ state }: { state: string }) {
  const [tone, label] = RUN[state] ?? ["", state];
  return <span className={`pill ${tone}`}>{label}</span>;
}

export function TicketStatusPill({ status }: { status: string }) {
  return <span className={`pill ${TICKET[status] ?? ""}`}>{status}</span>;
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
