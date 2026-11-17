import { eq } from "drizzle-orm";
import { NODE_KINDS, OUTPUT_TYPES, type Flow, type FlowSnapshot, type LibraryNode, type NodeInput, type NodeOutput } from "@clauderon/core";
import type { Db } from "./client";
import { flow, flowEdge, flowNode, node } from "./schema";

const isOutputType = (t: string): t is NodeInput["type"] => (OUTPUT_TYPES as readonly string[]).includes(t);

/** The Node library in the shape the domain core validates. */
export async function loadLibrary(db: Db): Promise<LibraryNode[]> {
  const rows = await db.select().from(node);
  return rows.map((n) => ({
    id: n.id,
    name: n.name,
    kind: NODE_KINDS.includes(n.kind) ? n.kind : "agent",
    inputs: n.inputs.filter((i) => isOutputType(i.type)) as NodeInput[],
    outputs: n.outputs.filter((o) => isOutputType(o.type)) as NodeOutput[],
  }));
}

export async function loadFlow(db: Db, flowId: string): Promise<Flow> {
  const nodes = await db.select().from(flowNode).where(eq(flowNode.flowId, flowId));
  const edges = await db.select().from(flowEdge).where(eq(flowEdge.flowId, flowId));
  return {
    nodes: nodes.map((n) => ({ id: n.id, nodeId: n.nodeId, x: n.x, y: n.y, enabledOptionalOutputs: n.enabledOptionalOutputs })),
    edges: edges.map((e) => ({
      id: e.id,
      fromFlowNodeId: e.fromFlowNodeId,
      fromOutput: e.fromOutput,
      toFlowNodeId: e.toFlowNodeId,
      toInput: e.toInput,
    })),
  };
}

export async function listFlows(db: Db) {
  return db.select().from(flow).orderBy(flow.name);
}

/** The Flow as it is now, frozen into `run.flow_snapshot` at Start. */
export async function buildFlowSnapshot(db: Db, flowId: string): Promise<FlowSnapshot | null> {
  const [row] = await db.select().from(flow).where(eq(flow.id, flowId));
  if (!row) return null;
  const placements = await db.select({ placement: flowNode, node }).from(flowNode).innerJoin(node, eq(node.id, flowNode.nodeId)).where(eq(flowNode.flowId, flowId));
  const { edges } = await loadFlow(db, flowId);
  return {
    name: row.name,
    nodes: placements.map(({ placement, node: n }) => ({
      id: placement.id,
      nodeId: n.id,
      name: placement.label ?? n.name,
      kind: n.kind,
      instructions: n.instructions,
      command: n.command,
      inputs: n.inputs.filter((i) => isOutputType(i.type)) as NodeInput[],
      outputs: n.outputs.filter((o) => isOutputType(o.type)) as NodeOutput[],
      extraInstructions: placement.extraInstructions,
      enabledOptionalOutputs: placement.enabledOptionalOutputs,
      x: placement.x,
      y: placement.y,
    })),
    edges,
  };
}
