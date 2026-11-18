"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import type { HumanAction } from "@clauderon/db";
import { answersFromForm } from "../../../server/grill-answers";
import { respondAs } from "../../../server/runs";
import { deps, requireMember } from "../../../server/runtime";

export type RespondFormState = { error: string | null; done: boolean };

/**
 * Approve, Reject or Answer (spec M3 §2, §3, MEM-2) from Needs you or the Run
 * page: any Member. Grill answers arrive as `answer:<id>` and `other:<id>` fields.
 */
export async function respondAction(_state: RespondFormState, form: FormData): Promise<RespondFormState> {
  const member = await requireMember();
  const requestId = String(form.get("requestId") ?? "");
  const runId = String(form.get("runId") ?? "");
  const decision = String(form.get("decision") ?? "");
  let action: HumanAction;
  if (decision === "approve") action = { decision: "approve" };
  else if (decision === "reject") action = { decision: "reject", feedback: String(form.get("feedback") ?? "") };
  else if (decision === "answer") action = { decision: "answer", answers: answersFromForm(form) };
  else return { error: "Pick Approve, Reject or Answer.", done: false };

  const result = await respondAs(deps(), member, requestId, action);
  if (result === "not-found") notFound();
  revalidatePath("/needs-you");
  if (/^[0-9a-f-]{36}$/i.test(runId)) revalidatePath(`/runs/${runId}`);
  revalidatePath("/", "layout");
  return result.ok ? { error: null, done: true } : { error: result.error, done: false };
}
