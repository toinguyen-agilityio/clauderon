"use server";

import { revalidatePath } from "next/cache";
import { cloneMyFlow, deleteMyFlow } from "../../../server/flows";
import { deps, requireMember } from "../../../server/runtime";

export type FlowFormState = { error: string | null; notice: string | null };

export async function flowActionAction(_state: FlowFormState, form: FormData): Promise<FlowFormState> {
  const member = await requireMember();
  const flowId = String(form.get("flowId") ?? "");
  const action = String(form.get("action"));
  if (action === "clone") {
    const result = await cloneMyFlow(deps(), member, flowId);
    revalidatePath("/flows");
    return result.ok ? { error: null, notice: `Created ${result.name}.` } : { error: result.error, notice: null };
  }
  if (action === "delete") {
    const result = await deleteMyFlow(deps(), member, flowId);
    revalidatePath("/flows");
    return result.ok ? { error: null, notice: "Flow deleted." } : { error: result.error, notice: null };
  }
  return { error: "Unknown action.", notice: null };
}
