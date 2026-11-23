"use server";

import { revalidatePath } from "next/cache";
import { syncAllProjects } from "../../../server/projects";
import { deps, requireMember } from "../../../server/runtime";
import { startDialog, startRuns, type StartInput, type StartResult } from "../../../server/start";

export async function loadStartDialog(ticketIds: string[]) {
  const member = await requireMember();
  return startDialog(deps(), member, ticketIds);
}

export async function startAction(input: StartInput): Promise<StartResult> {
  const member = await requireMember();
  const result = await startRuns(deps(), member, input);
  revalidatePath("/tickets");
  return result;
}

/** Pulls GitHub for the Projects not synced in the last minute; true when any Project was synced. */
export async function syncTicketsAction(): Promise<boolean> {
  await requireMember();
  return syncAllProjects(deps());
}
