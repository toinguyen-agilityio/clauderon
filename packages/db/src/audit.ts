import { and, desc, eq, type SQL } from "drizzle-orm";
import type { Db } from "./client";
import { auditEntry } from "./schema";

// The audit log (RUN-15, NFR-2): entries are written next to each action;
// these are the reads for the `/audit` page and the Run page's history.

export type AuditEntry = typeof auditEntry.$inferSelect;
export type AuditFilters = { actorEmail?: string; action?: string };
export const AUDIT_PAGE_SIZE = 50;

/** Entries newest first, filtered by Member and action; with the values the filters offer. */
export async function listAudit(db: Db, filters: AuditFilters, page = 1) {
  const conditions: SQL[] = [];
  if (filters.actorEmail) conditions.push(eq(auditEntry.actorEmail, filters.actorEmail));
  if (filters.action) conditions.push(eq(auditEntry.action, filters.action));
  const rows = await db
    .select()
    .from(auditEntry)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditEntry.at), desc(auditEntry.createdAt), desc(auditEntry.id))
    .limit(AUDIT_PAGE_SIZE + 1)
    .offset((Math.max(1, page) - 1) * AUDIT_PAGE_SIZE);
  const [actors, actions] = await Promise.all([
    db.selectDistinct({ v: auditEntry.actorEmail }).from(auditEntry).orderBy(auditEntry.actorEmail),
    db.selectDistinct({ v: auditEntry.action }).from(auditEntry).orderBy(auditEntry.action),
  ]);
  return {
    rows: rows.slice(0, AUDIT_PAGE_SIZE),
    hasMore: rows.length > AUDIT_PAGE_SIZE,
    actors: actors.map((a) => a.v),
    actions: actions.map((a) => a.v),
  };
}

/** One subject's entries, newest first: a Run's history on its page (spec M3 §7). */
export async function auditOfSubject(db: Db, subjectType: string, subjectId: string): Promise<AuditEntry[]> {
  return db
    .select()
    .from(auditEntry)
    .where(and(eq(auditEntry.subjectType, subjectType), eq(auditEntry.subjectId, subjectId)))
    .orderBy(desc(auditEntry.at), desc(auditEntry.createdAt));
}
