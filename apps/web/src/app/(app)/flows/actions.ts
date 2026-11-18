"use server";

import { revalidatePath } from "next/cache";
import { cloneMyFlow, deleteMyFlow } from "../../../server/flows";
import { deps, requireMember } from "../../../server/runtime";

export type FlowFormState = { error: string | null; notice: string | null; /** The Flow a clone just made, so the row can link to it. */ openFlowId: string | null };

export async function flowActionAction(_state: FlowFormState, form: FormData): Promise<FlowFormState> {
  const member = await requireMember();
  const flowId = String(form.get("flowId") ?? "");
  const action = String(form.get("action"));
  if (action === "clone") {
    const result = await cloneMyFlow(deps(), member, flowId);
    revalidatePath("/flows");
    return result.ok ? { error: null, notice: `Created ${result.name}.`, openFlowId: result.flowId } : { error: result.error, notice: null, openFlowId: null };
  }
  if (action === "delete") {
    const result = await deleteMyFlow(deps(), member, flowId);
    revalidatePath("/flows");
    return result.ok ? { error: null, notice: "Flow deleted.", openFlowId: null } : { error: result.error, notice: null, openFlowId: null };
  }
  return { error: "Unknown action.", notice: null, openFlowId: null };
}
