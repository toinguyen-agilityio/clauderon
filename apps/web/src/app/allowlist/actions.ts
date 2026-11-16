"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { addToAllowlist, removeFromAllowlist } from "../../server/access";
import { deps, requireMember } from "../../server/runtime";

export type FormState = { error: string | null };

const ADD_ERRORS = {
  "invalid-email": "Enter a full email address, like name@example.com.",
  duplicate: "That email is already allowed.",
} as const;

export async function addEmail(_state: FormState, form: FormData): Promise<FormState> {
  const actor = await requireMember();
  const result = await addToAllowlist(deps(), actor, String(form.get("email") ?? ""));
  if (result === "not-found") notFound();
  revalidatePath("/allowlist");
  return { error: result.ok ? null : ADD_ERRORS[result.reason] };
}

export async function removeEmail(form: FormData): Promise<void> {
  const actor = await requireMember();
  const result = await removeFromAllowlist(deps(), actor, String(form.get("email") ?? ""));
  if (result === "not-found") notFound();
  revalidatePath("/allowlist");
}
