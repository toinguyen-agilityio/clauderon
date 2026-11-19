"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { addToAllowlist } from "../../../server/access";
import { removeMachine } from "../../../server/machines";
import { removeMember } from "../../../server/members";
import { deps, requireMember } from "../../../server/runtime";

export type FormState = { error: string | null };
/** `runsHref` links to the Runs that block removing a Member or their Machine. */
export type ConfirmState = { error: string | null; runsHref?: string; done?: boolean };

const ADD_ERRORS = {
  "invalid-email": "Enter a full email address, like name@example.com.",
  duplicate: "That email is already on the team.",
} as const;

const refresh = () => {
  revalidatePath("/members");
  revalidatePath("/machines", "layout");
};

const runsOf = (machineId: string) => `/runs?machine=${machineId}`;

export async function addEmail(_state: FormState, form: FormData): Promise<FormState> {
  const actor = await requireMember();
  const result = await addToAllowlist(deps(), actor, String(form.get("email") ?? ""));
  if (result === "not-found") notFound();
  refresh();
  return { error: result.ok ? null : ADD_ERRORS[result.reason] };
}

export async function removeMemberAction(_state: ConfirmState, form: FormData): Promise<ConfirmState> {
  const actor = await requireMember();
  const result = await removeMember(deps(), actor, String(form.get("email") ?? ""));
  if (result === "not-found") notFound();
  refresh();
  if (result.ok) return { error: null, done: true };
  if (result.reason === "active-runs") {
    const n = result.activeRuns;
    return {
      error: `Their Machine still has ${n} Active ${n === 1 ? "Run" : "Runs"}. Cancel ${n === 1 ? "it" : "them"} or wait until ${n === 1 ? "it ends" : "they end"}, then remove again.`,
      runsHref: runsOf(result.machineId),
    };
  }
  return { error: result.reason === "operator" ? "Operator emails come from configuration and cannot be removed." : "That email is no longer on the team." };
}

export async function removeMachineAction(_state: ConfirmState, form: FormData): Promise<ConfirmState> {
  const actor = await requireMember();
  const machineId = String(form.get("machineId") ?? "");
  const result = await removeMachine(deps(), actor, machineId);
  if (result === "not-found") notFound();
  refresh();
  return result.ok
    ? { error: null, done: true }
    : { error: "The Machine still has Active Runs. Cancel them or wait until they end, then remove again.", runsHref: runsOf(machineId) };
}
