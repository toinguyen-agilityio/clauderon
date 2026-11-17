"use server";

import { revalidatePath } from "next/cache";
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
