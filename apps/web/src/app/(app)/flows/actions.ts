"use server";

import { revalidatePath } from "next/cache";
import { cloneMyFlow, createMyFlow, deleteMyFlow, exportMyFlow, importMyFlow, type CreateFlowResult, type ExportFlowResult, type ImportFlowResult } from "../../../server/flows";
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

/** Creates an empty Flow (with the Ticket Node placed) for the editor to open. */
export async function createFlowAction(name: string): Promise<CreateFlowResult> {
  const member = await requireMember();
  const result = await createMyFlow(deps(), member, name);
  revalidatePath("/flows");
  return result;
}

/** The file for one Flow; the browser turns it into a download. */
export async function exportFlowAction(flowId: string): Promise<ExportFlowResult> {
  await requireMember();
  return exportMyFlow(deps(), flowId);
}

/** Creates a Flow of the Member's own from the text of a Flow file. */
export async function importFlowAction(text: string): Promise<ImportFlowResult> {
  const member = await requireMember();
  const result = await importMyFlow(deps(), member, text);
  revalidatePath("/flows");
  revalidatePath("/flows/library");
  return result;
}
