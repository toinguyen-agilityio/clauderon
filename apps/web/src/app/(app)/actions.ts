"use server";

import { needsYouCount } from "../../server/runs";
import { deps, requireMember } from "../../server/runtime";

/** The Needs you badge, refreshed by the shell without reloading the page. */
export async function needsYouAction(): Promise<number> {
  await requireMember();
  return needsYouCount(deps());
}
