import { z } from "zod";

export const TOUR_KEY = "clauderon.tour";

export type Lang = "en" | "vi";

const saved = z.object({
  status: z.enum(["finished", "skipped", "inProgress"]),
  step: z.number().int().min(0).default(0),
  lang: z.enum(["en", "vi"]).optional(),
});

/** "new": never seen (or nothing usable saved). */
export type TourState = { status: "new" | "finished" | "skipped" | "inProgress"; step: number; lang?: Lang };

const NEW: TourState = { status: "new", step: 0 };

/** The saved state; a missing, corrupt, wrong-shape or unreadable value counts as a new Member, never an error. */
export function readTour(storage: Pick<Storage, "getItem"> | null | undefined): TourState {
  try {
    const raw = storage?.getItem(TOUR_KEY);
    if (!raw) return NEW;
    const parsed = saved.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : NEW;
  } catch {
    return NEW;
  }
}

/** Best effort: a full or blocked storage must not break the tour. */
export function writeTour(storage: Pick<Storage, "setItem"> | null | undefined, state: Omit<TourState, "status"> & { status: Exclude<TourState["status"], "new"> }): void {
  try {
    storage?.setItem(TOUR_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
