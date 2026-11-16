import { eq } from "drizzle-orm";
import { NODE_KINDS, OUTPUT_TYPES, type Flow, type LibraryNode, type NodeInput, type NodeOutput } from "@clauderon/core";
import type { Db } from "./client.js";
import { flow, flowEdge, flowNode, node } from "./schema.js";

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
