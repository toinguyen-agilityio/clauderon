"use server";

import { revalidatePath } from "next/cache";
import { deps, requireMember } from "../../../server/runtime";
import { pullRequestStartDialog, startFromPullRequests, type StartPullRequestsInput, type StartResult } from "../../../server/start";

export async function loadPullRequestStartDialog(count: number) {
  const member = await requireMember();
  return pullRequestStartDialog(deps(), member, count);
}

export async function startPullRequestsAction(input: StartPullRequestsInput): Promise<StartResult> {
  const member = await requireMember();
  const result = await startFromPullRequests(deps(), member, input);
  revalidatePath("/pull-requests");
  return result;
}
