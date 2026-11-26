import { inArray } from "drizzle-orm";
import type { NodeInput, NodeKind, NodeOutput } from "@clauderon/core";
import type { Db } from "./client";
import { recordFlowVersion } from "./flow-history";
import { flow, flowEdge, flowNode, node } from "./schema";

// Sample Nodes and Flows of requirements §4.4 (FLW-8), keyed by slug so
// seeding again updates them instead of adding copies.

/** The author of a sample nobody has changed yet; the pages show no author for it. */
export const SEEDED_BY = "seed@clauderon";

type SampleNode = {
  slug: string;
  name: string;
  kind: NodeKind;
  instructions: string;
  command?: string;
  inputs: NodeInput[];
  outputs: NodeOutput[];
};

const input = (name: NodeInput["type"], required = true): NodeInput => ({ name, type: name, required });
const out = (name: NodeOutput["type"], optional = false): NodeOutput => ({ name, type: name, optional });

export const sampleNodes: SampleNode[] = [
  {
    slug: "ticket",
    name: "Ticket",
    kind: "input",
    instructions: "Starts a Flow from a GitHub issue: one Run per Ticket.",
    inputs: [],
    outputs: [out("issue")],
  },
  {
    slug: "input-branch",
    name: "Branch",
    kind: "input",
    instructions: "Starts a Flow from a branch: the Run works on a new branch made from it.",
    inputs: [],
    outputs: [out("branch")],
  },
  {
    slug: "input-pull-request",
    name: "Pull request",
    kind: "input",
    instructions: "Starts a Flow from an open pull request.",
    inputs: [],
    outputs: [out("pull-request")],
  },
  {
    slug: "input-plan",
    name: "Plan",
    kind: "input",
    instructions: "Starts a Flow from a plan the Member writes when starting the Run.",
    inputs: [],
    outputs: [out("plan")],
  },
  {
    slug: "input-summary",
    name: "Summary",
    kind: "input",
    instructions: "Starts a Flow from free text the Member writes when starting the Run.",
    inputs: [],
    outputs: [out("summary")],
  },
  {
    slug: "grill-a-plan",
    name: "Grill a plan",
    kind: "grill",
    instructions:
      "Read the issue and the code it touches. Ask the questions you need answered before you can write a plan, all in one batch. When nothing is unclear, write a short step-by-step plan.",
    inputs: [input("issue")],
    outputs: [out("plan")],
  },
  {
    slug: "draft-a-plan",
    name: "Draft a plan",
    kind: "agent",
    instructions: "Read the issue and the code it touches. Write a short step-by-step plan for the change. Do not edit files.",
    inputs: [input("issue")],
    outputs: [out("plan")],
  },
  {
    slug: "approve-a-plan",
    name: "Approve a plan",
    kind: "approve",
    instructions: "Read the plan. Approve it, or reject it with feedback for the next try.",
    inputs: [input("plan")],
    outputs: [out("plan")],
  },
  {
    slug: "code-a-change",
    name: "Code a change",
    kind: "agent",
    instructions:
      "Make the change the issue or the plan asks for, following the plan when there is one. Add or update tests. Commit your work on the current branch with a clear message. Summarise what you changed.",
    inputs: [
      { name: "issue", type: "issue", group: "context", required: false },
      { name: "plan", type: "plan", group: "context", required: false },
    ],
    outputs: [out("branch"), out("summary", true)],
  },
  {
    slug: "run-tests",
    name: "Run tests",
    kind: "command",
    instructions: "Run the repository's tests.",
    command: "npm test --if-present || make test",
    inputs: [input("branch")],
    outputs: [out("test-result")],
  },
  {
    slug: "capture-screenshots",
    name: "Capture screenshots",
    kind: "command",
    instructions: "Capture screenshots of the pages the change touches.",
    command: "npm run screenshots --if-present",
    inputs: [input("branch")],
    outputs: [out("screenshot")],
  },
  {
    slug: "open-a-pull-request",
    name: "Open a pull request",
    kind: "command",
    instructions: "Push the branch and open a pull request, or reuse the open one for this branch.",
    command: "clauderon-open-pr",
    inputs: [input("branch"), input("test-result", false), input("summary", false)],
    outputs: [out("pull-request", true)],
  },
  {
    slug: "approve-the-pull-request",
    name: "Approve the pull request",
    kind: "approve",
    instructions: "Review the pull request. Approve it, or reject it with feedback for the next try.",
    inputs: [input("pull-request")],
    outputs: [out("pull-request")],
  },
];

type SamplePlacement = { key: string; node: string; x: number; y: number; enabledOptionalOutputs?: string[] };
type SampleEdge = [from: string, output: string, to: string, input: string];
type SampleFlow = { slug: string; name: string; nodes: SamplePlacement[]; edges: SampleEdge[] };

// Placed left to right, as the editor's Tidy up lays them out: Outputs sit on a Node's
// right side and inputs on its left, so wires then run forward instead of looping.
export const sampleFlows: SampleFlow[] = [
  {
    slug: "basic-ticket-delivery",
    name: "Basic ticket delivery",
    nodes: [
      { key: "ticket", node: "ticket", x: 0, y: 40 },
      { key: "code", node: "code-a-change", x: 216, y: 0, enabledOptionalOutputs: ["summary"] },
      { key: "tests", node: "run-tests", x: 520, y: 0 },
      { key: "pr", node: "open-a-pull-request", x: 824, y: 0, enabledOptionalOutputs: ["pull-request"] },
    ],
    edges: [
      ["ticket", "issue", "code", "issue"],
      ["code", "branch", "tests", "branch"],
      ["code", "branch", "pr", "branch"],
      ["code", "summary", "pr", "summary"],
      ["tests", "test-result", "pr", "test-result"],
    ],
  },
  {
    slug: "plan-and-deliver",
    name: "Plan and deliver",
    nodes: [
      { key: "ticket", node: "ticket", x: 0, y: 136 },
      { key: "grill", node: "grill-a-plan", x: 216, y: 112 },
      { key: "approvePlan", node: "approve-a-plan", x: 520, y: 112 },
      { key: "code", node: "code-a-change", x: 824, y: 104, enabledOptionalOutputs: ["summary"] },
      { key: "tests", node: "run-tests", x: 1128, y: 208 },
      // Above the pull request: ties in run order go by y first (RUN-2), so this keeps
      // screenshots running before the pull request opens.
      { key: "shots", node: "capture-screenshots", x: 1128, y: 0 },
      { key: "pr", node: "open-a-pull-request", x: 1432, y: 80, enabledOptionalOutputs: ["pull-request"] },
      { key: "approvePr", node: "approve-the-pull-request", x: 1736, y: 120 },
    ],
    edges: [
      ["ticket", "issue", "grill", "issue"],
      ["grill", "plan", "approvePlan", "plan"],
      ["approvePlan", "plan", "code", "plan"],
      ["ticket", "issue", "code", "issue"],
      ["code", "branch", "tests", "branch"],
      ["code", "branch", "shots", "branch"],
      ["code", "branch", "pr", "branch"],
      ["code", "summary", "pr", "summary"],
      ["tests", "test-result", "pr", "test-result"],
      ["pr", "pull-request", "approvePr", "pull-request"],
    ],
  },
];

/**
 * Idempotent: safe to run on every deploy. Samples are editable (FLW-8), so
 * seeding only adds the sample Nodes and Flows that are missing, matched by
 * slug, and never overwrites a Member's changes. A deleted sample comes back.
 */
export async function seedSamples(db: Db, now: Date = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    const sampleNodeSlugs = sampleNodes.map((n) => n.slug);
    await tx
      .insert(node)
      .values(
        sampleNodes.map((sample) => ({
          slug: sample.slug,
          name: sample.name,
          kind: sample.kind,
          instructions: sample.instructions,
          command: sample.command ?? null,
          inputs: sample.inputs,
          outputs: sample.outputs,
          isSample: true,
          updatedByEmail: SEEDED_BY,
          updatedAt: now,
        })),
      )
      .onConflictDoNothing({ target: node.slug });
    const nodeRows = await tx.select({ id: node.id, slug: node.slug }).from(node).where(inArray(node.slug, sampleNodeSlugs));
    const nodeIds = new Map(nodeRows.map((r) => [r.slug!, r.id]));

    for (const sample of sampleFlows) {
      const [row] = await tx
        .insert(flow)
        .values({ slug: sample.slug, name: sample.name, isSample: true, updatedByEmail: SEEDED_BY, updatedAt: now })
        .onConflictDoNothing({ target: flow.slug })
        .returning({ id: flow.id });
      if (!row) continue; // already there, possibly edited: keep it as it is
      const flowId = row.id;

      const placementIds = new Map<string, string>();
      for (const p of sample.nodes) {
        const [placed] = await tx
          .insert(flowNode)
          .values({ flowId, nodeId: nodeIds.get(p.node)!, x: p.x, y: p.y, enabledOptionalOutputs: p.enabledOptionalOutputs ?? [] })
          .returning({ id: flowNode.id });
        placementIds.set(p.key, placed!.id);
      }
      for (const [from, fromOutput, to, toInput] of sample.edges) {
        await tx.insert(flowEdge).values({
          flowId,
          fromFlowNodeId: placementIds.get(from)!,
          fromOutput,
          toFlowNodeId: placementIds.get(to)!,
          toInput,
        });
      }
      await recordFlowVersion(tx, { flowId, kind: "create", actorEmail: SEEDED_BY, now });
    }
  });
}
