"use server";

import { needsYouCount } from "../../server/runs";
import { tourFacts, type TourFacts } from "../../server/tour";
import { deps, requireMember } from "../../server/runtime";

/** The Needs you badge, refreshed by the shell without reloading the page. */
export async function needsYouAction(): Promise<number> {
  await requireMember();
  return needsYouCount(deps());
}

/** The Member's setup, for the guided tour's prerequisite checks. */
export async function tourFactsAction(): Promise<TourFacts> {
  const member = await requireMember();
  return tourFacts(deps(), member);
}
