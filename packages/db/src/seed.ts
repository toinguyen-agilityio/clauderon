import { eq } from "drizzle-orm";
import type { NodeInput, NodeKind, NodeOutput } from "@clauderon/core";
import type { Db } from "./client.js";
import { flow, flowEdge, flowNode, node } from "./schema.js";

// Sample Nodes and Flows of requirements §4.4 (FLW-8), keyed by slug so
// seeding again updates them instead of adding copies.

const SEEDED_BY = "seed@clauderon";

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
    kind: "ticket",
    instructions: "The entry of every Flow: emits the GitHub issue the Run works on.",
    inputs: [],
    outputs: [out("issue")],
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
      "Make the change the issue asks for, following the plan when there is one. Add or update tests. Commit your work on the current branch with a clear message. Summarise what you changed.",
    inputs: [input("issue"), input("plan", false)],
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

export const sampleFlows: SampleFlow[] = [
  {
    slug: "basic-ticket-delivery",
    name: "Basic ticket delivery",
    nodes: [
      { key: "ticket", node: "ticket", x: 0, y: 0 },
      { key: "code", node: "code-a-change", x: 0, y: 160, enabledOptionalOutputs: ["summary"] },
      { key: "tests", node: "run-tests", x: 0, y: 320 },
      { key: "pr", node: "open-a-pull-request", x: 0, y: 480, enabledOptionalOutputs: ["pull-request"] },
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
      { key: "ticket", node: "ticket", x: 0, y: 0 },
      { key: "grill", node: "grill-a-plan", x: 0, y: 160 },
      { key: "approvePlan", node: "approve-a-plan", x: 0, y: 320 },
      { key: "code", node: "code-a-change", x: 0, y: 480, enabledOptionalOutputs: ["summary"] },
      { key: "tests", node: "run-tests", x: -160, y: 640 },
      { key: "shots", node: "capture-screenshots", x: 160, y: 640 },
      { key: "pr", node: "open-a-pull-request", x: 0, y: 800, enabledOptionalOutputs: ["pull-request"] },
      { key: "approvePr", node: "approve-the-pull-request", x: 0, y: 960 },
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

/** Idempotent: safe to run on every deploy. */
export async function seedSamples(db: Db, now: Date = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    const nodeIds = new Map<string, string>();
    for (const sample of sampleNodes) {
      const values = {
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
      };
      const [row] = await tx
        .insert(node)
        .values(values)
        .onConflictDoUpdate({ target: node.slug, set: values })
        .returning({ id: node.id });
      nodeIds.set(sample.slug, row!.id);
    }

    for (const sample of sampleFlows) {
      const values = { slug: sample.slug, name: sample.name, isSample: true, updatedByEmail: SEEDED_BY, updatedAt: now };
      const [row] = await tx.insert(flow).values(values).onConflictDoUpdate({ target: flow.slug, set: values }).returning({ id: flow.id });
      const flowId = row!.id;

      // Samples are read-only and Runs keep a snapshot, so placements are rebuilt.
      await tx.delete(flowNode).where(eq(flowNode.flowId, flowId));
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
    }
  });
}
