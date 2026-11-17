"use server";

import { revalidatePath } from "next/cache";
import type { FlowGraphInput } from "@clauderon/db";
import { saveMyFlow, type SaveFlowOutcome } from "../../../../server/flows";
import { deps, requireMember } from "../../../../server/runtime";

export async function saveFlowAction(flowId: string, graph: FlowGraphInput): Promise<SaveFlowOutcome> {
  const member = await requireMember();
  const result = await saveMyFlow(deps(), member, flowId, graph);
  revalidatePath("/flows");
  return result;
}
