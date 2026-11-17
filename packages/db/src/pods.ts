import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "./client";
import { recordAudit } from "./access";
import { member, pod, run } from "./schema";

// Pods (spec M1 §2): one per Member, created with the default limits.

export type Pod = typeof pod.$inferSelect;
export const POD_DEFAULTS = { slots: 2, cpus: 2, memoryMb: 4096 } as const;

export type CreatePodResult = { ok: true; pod: Pod } | { ok: false; reason: "exists" };

/** Creates the Member's Pod row; a second one is refused by the unique `member_id` (POD-2). */
export async function createPod(db: Db, owner: { id: string; email: string }, imageTag: string): Promise<CreatePodResult> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(pod)
      .values({ memberId: owner.id, status: "creating", imageTag, ...POD_DEFAULTS })
      .onConflictDoNothing({ target: pod.memberId })
      .returning();
    if (!row) return { ok: false, reason: "exists" } as const;
    await recordAudit(tx, { actorEmail: owner.email, action: "pod.create", subjectType: "pod", subjectId: row.id });
    return { ok: true, pod: row } as const;
  });
}

export async function getPod(db: Db, id: string): Promise<Pod | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(pod).where(eq(pod.id, id));
  return row ?? null;
}

export async function getPodOfMember(db: Db, memberId: string): Promise<Pod | null> {
  const [row] = await db.select().from(pod).where(eq(pod.memberId, memberId));
  return row ?? null;
}

export type PodRunCounts = { inUse: number; queued: number };

/** Slots in use (Running or Waiting) and queue length per Pod. */
export async function podRunCounts(db: Db, podIds: readonly string[]): Promise<Map<string, PodRunCounts>> {
  const counts = new Map<string, PodRunCounts>(podIds.map((id) => [id, { inUse: 0, queued: 0 }]));
  if (podIds.length === 0) return counts;
  const rows = await db
    .select({ podId: run.podId, state: run.state, n: sql<number>`count(*)::int` })
    .from(run)
    .where(and(inArray(run.podId, [...podIds]), inArray(run.state, ["queued", "running", "waiting_for_human"])))
    .groupBy(run.podId, run.state);
  for (const r of rows) {
    const c = counts.get(r.podId)!;
    if (r.state === "queued") c.queued += r.n;
    else c.inUse += r.n;
  }
  return counts;
}

export type PodRow = Pod & { owner: { email: string; name: string | null; pictureUrl: string | null } } & PodRunCounts;

/** Every Pod with its owner, Slots in use and queue, for the Pods page (POD-4). */
export async function listPods(db: Db): Promise<PodRow[]> {
  const rows = await db
    .select({ pod, owner: { email: member.email, name: member.name, pictureUrl: member.pictureUrl } })
    .from(pod)
    .innerJoin(member, eq(member.id, pod.memberId))
    .orderBy(asc(member.email));
  const counts = await podRunCounts(
    db,
    rows.map((r) => r.pod.id),
  );
  return rows.map((r) => ({ ...r.pod, owner: r.owner, ...counts.get(r.pod.id)! }));
}

export type PodStatusUpdate = { podId: string; status: Pod["status"]; containerId: string | null; imageDigest: string | null };

/** Applies a `pod.status` from the Host Agent. */
export async function applyPodStatus(db: Db, update: PodStatusUpdate): Promise<Pod | null> {
  const [row] = await db
    .update(pod)
    .set({
      status: update.status,
      ...(update.containerId ? { containerId: update.containerId } : {}),
      ...(update.imageDigest ? { imageDigest: update.imageDigest } : {}),
    })
    .where(eq(pod.id, update.podId))
    .returning();
  return row ?? null;
}

export type PodLogins = { podId: string; claude: boolean; gh: boolean; ghAccount: string | null; tokenRepos: string[]; checkedAt: Date };

/** Applies a `pod.logins` from the Host Agent (POD-5). */
export async function applyPodLogins(db: Db, logins: PodLogins): Promise<Pod | null> {
  const [row] = await db
    .update(pod)
    .set({
      claudeLoggedIn: logins.claude,
      ghLoggedIn: logins.gh,
      ghAccount: logins.ghAccount,
      ghTokenScope: { tokenRepos: logins.tokenRepos },
      loginsCheckedAt: logins.checkedAt,
    })
    .where(eq(pod.id, logins.podId))
    .returning();
  return row ?? null;
}

export async function setPodStatus(db: Db, podId: string, status: Pod["status"]): Promise<void> {
  await db.update(pod).set({ status }).where(eq(pod.id, podId));
}
