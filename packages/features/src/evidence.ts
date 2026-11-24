import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Feature } from "./schema";

export type MapEntry = {
  /** Only for features that are not a requirement row, or to replace a Pod-era wording. */
  name?: string;
  summary?: string;
  milestone?: Feature["milestone"];
  /** Set by hand when the repo cannot show it: `removed` (with a reason), `partial` or `not-started`. */
  status?: "removed" | "partial" | "not-started";
  reason?: string;
  paths?: string[];
  docs?: string[];
};

/**
 * The evidence for one feature: which of its mapped paths exist in the repo.
 * `done` needs every path, `partial` some, `not-started` none. A status set by hand wins.
 * The roadmap status report (#131) should read the same map and this function, so the two agree.
 */
export function statusFromEvidence(
  entry: MapEntry,
  root: string,
): { status: Feature["status"]; missing: string[] } {
  const paths = entry.paths ?? [];
  const missing = paths.filter((p) => !existsSync(join(root, p)));
  if (entry.status) return { status: entry.status, missing };
  if (paths.length === 0) return { status: "not-started", missing };
  if (missing.length === 0) return { status: "done", missing };
  return { status: missing.length === paths.length ? "not-started" : "partial", missing };
}
