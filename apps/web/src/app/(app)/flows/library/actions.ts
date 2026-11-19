"use server";

import { revalidatePath } from "next/cache";
import { cloneMyNode, createMyNode, deleteMyNode, updateMyNode, type LibraryInput, type CloneNodeOutcome, type NodeOutcome } from "../../../../server/library";
import { deps, requireMember } from "../../../../server/runtime";

/** Create (no id) or edit a library Node; the form sends it as one object. */
export async function saveNodeAction(nodeId: string | null, input: LibraryInput): Promise<NodeOutcome> {
  const member = await requireMember();
  const result = nodeId ? await updateMyNode(deps(), member, nodeId, input) : await createMyNode(deps(), member, input);
  revalidatePath("/flows/library");
  revalidatePath("/flows");
  return result;
}

export async function deleteNodeAction(nodeId: string): Promise<NodeOutcome> {
  const member = await requireMember();
  const result = await deleteMyNode(deps(), member, nodeId);
  revalidatePath("/flows/library");
  return result;
}

/** Clone a sample Node into the library as an editable copy. */
export async function cloneNodeAction(nodeId: string): Promise<CloneNodeOutcome> {
  const member = await requireMember();
  const result = await cloneMyNode(deps(), member, nodeId);
  revalidatePath("/flows/library");
  revalidatePath("/flows");
  return result;
}
