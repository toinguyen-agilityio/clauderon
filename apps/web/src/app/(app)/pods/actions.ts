"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { createMyPod, podAction, setMyPodLimits, type PodAction } from "../../../server/pods";
import { deps, requireMember } from "../../../server/runtime";

export type PodFormState = { error: string | null };

export async function createPodAction(): Promise<void> {
  const member = await requireMember();
  await createMyPod(deps(), member);
  revalidatePath("/pods");
}

const ACTIONS: readonly PodAction[] = ["start", "stop", "refresh"];

export async function podActionAction(_state: PodFormState, form: FormData): Promise<PodFormState> {
  const member = await requireMember();
  const action = String(form.get("action")) as PodAction;
  if (!ACTIONS.includes(action)) notFound();
  const result = await podAction(deps(), member, String(form.get("podId") ?? ""), action);
  if (result === "not-found") notFound();
  revalidatePath("/pods");
  return { error: result.ok ? null : "Stop is refused while the Pod has Running or Waiting Runs." };
}

export type LimitsFormState = { error: string | null; saved: boolean };

export async function setLimitsAction(_state: LimitsFormState, form: FormData): Promise<LimitsFormState> {
  const member = await requireMember();
  const result = await setMyPodLimits(deps(), member, String(form.get("podId") ?? ""), {
    slots: form.get("slots"),
    cpus: form.get("cpus"),
    memoryMb: form.get("memoryMb"),
  });
  if (result === "not-found") notFound();
  revalidatePath("/pods");
  return result.ok ? { error: null, saved: true } : { error: result.error, saved: false };
}
