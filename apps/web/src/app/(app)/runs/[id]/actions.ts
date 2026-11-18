"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { cancelRunAs } from "../../../../server/runs";
import { deps, requireMember } from "../../../../server/runtime";

export type CancelFormState = { error: string | null };

/** Cancel (RUN-8): any Member, any Active Run. */
export async function cancelRunAction(_state: CancelFormState, form: FormData): Promise<CancelFormState> {
  const member = await requireMember();
  const runId = String(form.get("runId") ?? "");
  const result = await cancelRunAs(deps(), member, runId);
  if (result === "not-found") notFound();
  revalidatePath(`/runs/${runId}`);
  revalidatePath("/runs");
  revalidatePath("/pods", "layout");
  return { error: result.ok ? null : "This Run has already ended." };
}
