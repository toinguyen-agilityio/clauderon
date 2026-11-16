// One pill for Run states, Node states and Ticket Statuses.

const TONE: Record<string, string> = {
  queued: "wait",
  Queued: "wait",
  running: "run",
  "In run": "run",
  waiting_for_human: "acc",
  "Needs you": "acc",
  succeeded: "ok",
  "PR merged": "ok",
  "PR open": "run",
  failed: "fail",
  Failed: "fail",
  interrupted: "fail",
  Interrupted: "fail",
  cancelled: "",
  Closed: "",
  "not reached": "",
  Open: "plain",
  creating: "wait",
  stopped: "",
  error: "fail",
  deleting: "wait",
};

const LABEL: Record<string, string> = { waiting_for_human: "waiting for you" };

export function StatePill({ state }: { state: string }) {
  return <span className={`pill ${TONE[state] ?? ""}`}>{LABEL[state] ?? state}</span>;
}
