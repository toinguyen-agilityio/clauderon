"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import {
  approveMyPairing,
  checkMyLogins,
  lookUpPairing,
  removeMachine,
  setMyMachineSettings,
  updateMyAgent,
  type PairingPreview,
} from "../../../server/machines";
import { deps, requireMember } from "../../../server/runtime";

export type MachineFormState = { error: string | null };

export type UpdateFormState = { error: string | null; asked: boolean };

export type PairFormState = { error: string | null; pairing: PairingPreview | null };

/** Pairing, step 1: show which computer the code belongs to. */
export async function lookUpPairingAction(_state: PairFormState, form: FormData): Promise<PairFormState> {
  const member = await requireMember();
  const result = await lookUpPairing(deps(), member, String(form.get("code") ?? ""));
  return result.ok ? { error: null, pairing: result.pairing } : { error: result.error, pairing: null };
}

/** Pairing, step 2: approve it, then open the Machine's page. */
export async function approvePairingAction(_state: PairFormState, form: FormData): Promise<PairFormState> {
  const member = await requireMember();
  const result = await approveMyPairing(deps(), member, String(form.get("code") ?? ""));
  if (!result.ok) return { error: result.error, pairing: null };
  revalidatePath("/machines", "layout");
  redirect(`/machines/${result.machineId}`);
}

export async function checkLoginsAction(_state: MachineFormState, form: FormData): Promise<MachineFormState> {
  const member = await requireMember();
  const result = await checkMyLogins(deps(), member, String(form.get("machineId") ?? ""));
  if (result === "not-found") notFound();
  revalidatePath("/machines", "layout");
  return { error: null };
}

export async function updateAgentAction(_state: UpdateFormState, form: FormData): Promise<UpdateFormState> {
  const member = await requireMember();
  const result = await updateMyAgent(deps(), member, String(form.get("machineId") ?? ""));
  if (result === "not-found") notFound();
  revalidatePath("/machines", "layout");
  return { error: null, asked: true };
}

export type SettingsFormState = { error: string | null; saved: boolean };

export async function setSettingsAction(_state: SettingsFormState, form: FormData): Promise<SettingsFormState> {
  const member = await requireMember();
  const result = await setMyMachineSettings(deps(), member, String(form.get("machineId") ?? ""), {
    name: form.get("name"),
    slots: form.get("slots"),
  });
  if (result === "not-found") notFound();
  revalidatePath("/machines", "layout");
  return result.ok ? { error: null, saved: true } : { error: result.error, saved: false };
}

/** Remove a Machine, then back to the Machines page. */
export async function removeMachineAction(_state: MachineFormState, form: FormData): Promise<MachineFormState> {
  const member = await requireMember();
  const result = await removeMachine(deps(), member, String(form.get("machineId") ?? ""));
  if (result === "not-found") notFound();
  if (!result.ok) return { error: "The Machine still has Active Runs. Cancel them first, or wait until they end." };
  revalidatePath("/machines", "layout");
  redirect("/machines");
}
