"use server";

import { revalidatePath } from "next/cache";
import { cloneMyDeletedFlow, restoreMyFlowVersion, type CloneFlowResult, type RestoreOutcome } from "../../../../../server/flows";
import { deps, requireMember } from "../../../../../server/runtime";

export async function restoreVersionAction(flowId: string, versionId: string): Promise<RestoreOutcome> {
  const member = await requireMember();
  const result = await restoreMyFlowVersion(deps(), member, flowId, versionId);
  revalidatePath("/flows");
  revalidatePath(`/flows/${flowId}`);
  revalidatePath(`/flows/${flowId}/history`);
  return result;
}

export async function cloneVersionAction(flowId: string, versionId: string): Promise<CloneFlowResult> {
  const member = await requireMember();
  const result = await cloneMyDeletedFlow(deps(), member, flowId, versionId);
  revalidatePath("/flows");
  return result;
}
