/** Below this much free disk (GB), a Run's worktree may not fit. */
export const LOW_DISK_GB = 5;
/** Below this much free disk (GB), a Run is about to fail. */
export const CRITICAL_DISK_GB = 1;

export type DiskState = "ok" | "low" | "critical" | "unknown";

/** How full a Machine's disk is, from its free GB; a missing or unreadable value is unknown, never 0. */
export function diskState(freeGb: number | null | undefined): DiskState {
  if (freeGb === null || freeGb === undefined || !Number.isFinite(freeGb)) return "unknown";
  if (freeGb < CRITICAL_DISK_GB) return "critical";
  if (freeGb < LOW_DISK_GB) return "low";
  return "ok";
}
