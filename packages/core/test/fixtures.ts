import type { Flow, FlowEdge, FlowNode, LibraryNode } from "../src/index.js";

/** The sample library of requirements §4.4, keyed by slug. */
export const library: LibraryNode[] = [
  { id: "ticket", name: "Ticket", kind: "ticket", inputs: [], outputs: [{ name: "issue", type: "issue", optional: false }] },
  {
    id: "grill-a-plan",
    name: "Grill a plan",
    kind: "grill",
    inputs: [{ name: "issue", type: "issue", required: true }],
    outputs: [{ name: "plan", type: "plan", optional: false }],
  },
  {
    id: "draft-a-plan",
    name: "Draft a plan",
    kind: "agent",
    inputs: [{ name: "issue", type: "issue", required: true }],
    outputs: [{ name: "plan", type: "plan", optional: false }],
  },
  {
    id: "approve-a-plan",
    name: "Approve a plan",
    kind: "approve",
    inputs: [{ name: "plan", type: "plan", required: true }],
    outputs: [{ name: "plan", type: "plan", optional: false }],
  },
  {
    id: "code-a-change",
    name: "Code a change",
    kind: "agent",
    inputs: [
      { name: "issue", type: "issue", required: true },
      { name: "plan", type: "plan", required: false },
    ],
    outputs: [
      { name: "branch", type: "branch", optional: false },
      { name: "summary", type: "summary", optional: true },
    ],
  },
  {
    id: "run-tests",
    name: "Run tests",
    kind: "command",
    inputs: [{ name: "branch", type: "branch", required: true }],
    outputs: [{ name: "test-result", type: "test-result", optional: false }],
  },
  {
    id: "capture-screenshots",
    name: "Capture screenshots",
    kind: "command",
    inputs: [{ name: "branch", type: "branch", required: true }],
    outputs: [{ name: "screenshot", type: "screenshot", optional: false }],
  },
  {
    id: "open-a-pull-request",
    name: "Open a pull request",
    kind: "command",
    inputs: [
      { name: "branch", type: "branch", required: true },
      { name: "test-result", type: "test-result", required: false },
      { name: "summary", type: "summary", required: false },
    ],
    outputs: [{ name: "pull-request", type: "pull-request", optional: true }],
  },
  {
    id: "approve-the-pull-request",
    name: "Approve the pull request",
    kind: "approve",
    inputs: [{ name: "pull-request", type: "pull-request", required: true }],
    outputs: [{ name: "pull-request", type: "pull-request", optional: false }],
  },
];

export function fn(id: string, nodeId: string, y: number, x = 0, enabledOptionalOutputs: string[] = []): FlowNode {
  return { id, nodeId, x, y, enabledOptionalOutputs };
}

export function edge(from: string, fromOutput: string, to: string, toInput: string): FlowEdge {
  return { id: `${from}.${fromOutput}->${to}.${toInput}`, fromFlowNodeId: from, fromOutput, toFlowNodeId: to, toInput };
}

export const basicDelivery: Flow = {
  nodes: [
    fn("t", "ticket", 0),
    fn("code", "code-a-change", 1, 0, ["summary"]),
    fn("test", "run-tests", 2),
    fn("pr", "open-a-pull-request", 3, 0, ["pull-request"]),
  ],
  edges: [
    edge("t", "issue", "code", "issue"),
    edge("code", "branch", "test", "branch"),
    edge("code", "branch", "pr", "branch"),
    edge("code", "summary", "pr", "summary"),
    edge("test", "test-result", "pr", "test-result"),
  ],
};

export const planAndDeliver: Flow = {
  nodes: [
    fn("t", "ticket", 0),
    fn("grill", "grill-a-plan", 1),
    fn("approve", "approve-a-plan", 2),
    fn("code", "code-a-change", 3, 0, ["summary"]),
    fn("test", "run-tests", 4, 0),
    fn("shots", "capture-screenshots", 4, 1),
    fn("pr", "open-a-pull-request", 5, 0, ["pull-request"]),
    fn("approvePr", "approve-the-pull-request", 6),
  ],
  edges: [
    edge("t", "issue", "grill", "issue"),
    edge("grill", "plan", "approve", "plan"),
    edge("approve", "plan", "code", "plan"),
    edge("t", "issue", "code", "issue"),
    edge("code", "branch", "test", "branch"),
    edge("code", "branch", "shots", "branch"),
    edge("code", "branch", "pr", "branch"),
    edge("code", "summary", "pr", "summary"),
    edge("test", "test-result", "pr", "test-result"),
    edge("pr", "pull-request", "approvePr", "pull-request"),
  ],
};
