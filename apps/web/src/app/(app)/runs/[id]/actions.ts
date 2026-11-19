"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { cancelRunAs, retryAs } from "../../../../server/runs";
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
  revalidatePath("/machines", "layout");
  return { error: result.ok ? null : "This Run has already ended." };
}

export type RetryFormState = { error: string | null };

/** Retry from a Node (RUN-7): any Member, a Failed or Interrupted Run. */
export async function retryRunAction(_state: RetryFormState, form: FormData): Promise<RetryFormState> {
  const member = await requireMember();
  const runId = String(form.get("runId") ?? "");
  const result = await retryAs(deps(), member, runId, String(form.get("nodeId") ?? ""), String(form.get("note") ?? ""));
  if (result === "not-found") notFound();
  revalidatePath(`/runs/${runId}`);
  revalidatePath("/runs");
  revalidatePath("/machines", "layout");
  return { error: result.ok ? null : result.error };
}
