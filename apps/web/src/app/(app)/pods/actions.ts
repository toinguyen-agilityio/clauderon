"use server";

import { getPodOfMember } from "@clauderon/db";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { createMyPod, gbToMb, podAction, removePod, setMyPodSettings, type PodAction, type PodSettingsInput } from "../../../server/pods";
import { deps, requireMember } from "../../../server/runtime";

export type PodFormState = { error: string | null };

/** The create and settings dialogs: RAM is entered in GB. */
const settingsFrom = (form: FormData): PodSettingsInput => ({
  name: form.get("name"),
  slots: form.get("slots"),
  cpus: form.get("cpus"),
  memoryMb: gbToMb(form.get("memoryGb")),
});

/** Create my Pod from its dialog, then open the Pod page, where setup continues. */
export async function createPodAction(_state: PodFormState, form: FormData): Promise<PodFormState> {
  const member = await requireMember();
  const created = await createMyPod(deps(), member, settingsFrom(form));
  if (!created.ok && created.reason === "limits") return { error: created.error };
  revalidatePath("/pods", "layout");
  const podId = created.ok ? created.podId : (await getPodOfMember(deps().db, member.id))?.id;
  redirect(podId ? `/pods/${podId}` : "/pods");
}

const ACTIONS: readonly PodAction[] = ["start", "stop", "refresh"];

export async function podActionAction(_state: PodFormState, form: FormData): Promise<PodFormState> {
  const member = await requireMember();
  const action = String(form.get("action")) as PodAction;
  if (!ACTIONS.includes(action)) notFound();
  const result = await podAction(deps(), member, String(form.get("podId") ?? ""), action);
  if (result === "not-found") notFound();
  revalidatePath("/pods", "layout");
  return { error: result.ok ? null : "Stop is refused while the Pod has Running or Waiting Runs." };
}

export type LimitsFormState = { error: string | null; saved: boolean };

export async function setLimitsAction(_state: LimitsFormState, form: FormData): Promise<LimitsFormState> {
  const member = await requireMember();
  const result = await setMyPodSettings(deps(), member, String(form.get("podId") ?? ""), settingsFrom(form));
  if (result === "not-found") notFound();
  revalidatePath("/pods", "layout");
  return result.ok ? { error: null, saved: true } : { error: result.error, saved: false };
}

/** Remove Pod (POD-7), then back to the Pods page. */
export async function removePodAction(_state: PodFormState, form: FormData): Promise<PodFormState> {
  const member = await requireMember();
  const result = await removePod(deps(), member, String(form.get("podId") ?? ""));
  if (result === "not-found") notFound();
  if (!result.ok) return { error: "The Pod still has Active Runs. Cancel them first, or wait until they end." };
  revalidatePath("/pods", "layout");
  redirect("/pods");
}
