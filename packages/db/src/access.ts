import { createHash } from "node:crypto";
import { and, asc, eq, gt, isNull, sql, type SQL } from "drizzle-orm";
import pg from "pg";
import type { Db } from "./client";
import { allowlistEntry, auditEntry, member, memberAccount, session } from "./schema";

// Sign-in, sessions and the allowlist (spec M0 §7). Web and Gateway both use
// these, so every request re-checks the allowlist the same way.

export const SESSION_HOURS = 24;
export const MEMBER_REVOKED_CHANNEL = "member_revoked";

export type Member = typeof member.$inferSelect;
export type Publish = (email: string) => void | Promise<void>;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** `OPERATOR_EMAILS`: comma-separated, always allowed. */
export function parseOperatorEmails(value: string | undefined): string[] {
  return (value ?? "").split(",").map(normalizeEmail).filter(Boolean);
}

export function isOperator(email: string, operators: readonly string[]): boolean {
  return operators.includes(normalizeEmail(email));
}

export async function isAllowed(db: Db, email: string, operators: readonly string[]): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (operators.includes(normalized)) return true;
  const rows = await db.select({ email: allowlistEntry.email }).from(allowlistEntry).where(eq(allowlistEntry.email, normalized));
  return rows.length > 0;
}

export type GoogleProfile = { email: string; emailVerified: boolean; name: string | null; picture: string | null };
export type SignInResult = { ok: true; member: Member } | { ok: false; reason: "unverified" | "not-allowed" };

/** Decides a Google sign-in; creates or updates the Member when allowed. */
export async function signIn(db: Db, profile: GoogleProfile, operators: readonly string[], now: Date): Promise<SignInResult> {
  if (!profile.emailVerified) return { ok: false, reason: "unverified" };
  const email = normalizeEmail(profile.email);
  if (!(await isAllowed(db, email, operators))) return { ok: false, reason: "not-allowed" };

  const [row] = await db
    .insert(member)
    .values({ email, name: profile.name, pictureUrl: profile.picture, lastSignInAt: now })
    .onConflictDoUpdate({ target: member.email, set: { name: profile.name, pictureUrl: profile.picture, lastSignInAt: now } })
    .returning();
  return { ok: true, member: row! };
}

/** Ids come from cookies and tickets; a malformed one must not reach a uuid column. */
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(db: Db, memberId: string, token: string, now: Date) {
  const expiresAt = new Date(now.getTime() + SESSION_HOURS * 3_600_000);
  const [row] = await db.insert(session).values({ tokenHash: hashToken(token), memberId, expiresAt }).returning();
  return row!;
}

/**
 * The live session for a cookie value, or null when it is unknown, ended,
 * expired or its Member is no longer allowed. A refused Member's session is
 * ended on the spot.
 */
export async function loadSession(db: Db, token: string, operators: readonly string[], now: Date) {
  return loadLiveSession(db, eq(session.tokenHash, hashToken(token)), operators, now);
}

/** Same checks as `loadSession`, by session id (the Gateway's ticket names it). */
export async function loadSessionById(db: Db, sessionId: string, operators: readonly string[], now: Date) {
  if (!isUuid(sessionId)) return null;
  return loadLiveSession(db, eq(session.id, sessionId), operators, now);
}

async function loadLiveSession(db: Db, match: SQL, operators: readonly string[], now: Date) {
  const [row] = await db
    .select({ session, member })
    .from(session)
    .innerJoin(member, eq(member.id, session.memberId))
    .where(and(match, isNull(session.endedAt), gt(session.expiresAt, now)));
  if (!row) return null;
  if (!(await isAllowed(db, row.member.email, operators))) {
    await db.update(session).set({ endedAt: now }).where(eq(session.id, row.session.id));
    return null;
  }
  return row;
}

export async function endSession(db: Db, token: string, now: Date): Promise<void> {
  await db
    .update(session)
    .set({ endedAt: now })
    .where(and(eq(session.tokenHash, hashToken(token)), isNull(session.endedAt)));
}

/**
 * Ends a Member's access at once (spec M0 §7.1): ends their sessions and
 * publishes `member.revoked` so the Gateway closes their sockets with 4403.
 */
export async function endMemberAccess(db: Db, email: string, now: Date, publish: Publish): Promise<void> {
  const normalized = normalizeEmail(email);
  await db
    .update(session)
    .set({ endedAt: now })
    .where(and(isNull(session.endedAt), sql`${session.memberId} in (select id from member where email = ${normalized})`));
  await publish(normalized);
}

/** Publishes `member.revoked` through Postgres NOTIFY; the Gateway listens. */
export function notifyMemberRevoked(db: Db): Publish {
  return async (email) => {
    await db.execute(sql`select pg_notify(${MEMBER_REVOKED_CHANNEL}, ${email})`);
  };
}

export type AuditInput = {
  actorEmail: string;
  action: string;
  subjectType: string;
  subjectId: string;
  detail?: Record<string, unknown>;
};

export async function recordAudit(db: Db, entry: AuditInput): Promise<void> {
  await db.insert(auditEntry).values({ ...entry, detail: entry.detail ?? {} });
}

export type AllowlistRow = { email: string; fromConfiguration: boolean; addedByEmail: string | null; addedAt: Date | null };

export async function listAllowlist(db: Db, operators: readonly string[]): Promise<AllowlistRow[]> {
  const entries = await db.select().from(allowlistEntry).orderBy(asc(allowlistEntry.email));
  return [
    ...operators.map((email) => ({ email, fromConfiguration: true, addedByEmail: null, addedAt: null })),
    ...entries
      .filter((e) => !operators.includes(e.email))
      .map((e) => ({ email: e.email, fromConfiguration: false, addedByEmail: e.addedByEmail, addedAt: e.addedAt })),
  ];
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AddResult = { ok: true; email: string } | { ok: false; reason: "invalid-email" | "duplicate" };

export async function addAllowlistEntry(db: Db, actorEmail: string, email: string, operators: readonly string[]): Promise<AddResult> {
  const normalized = normalizeEmail(email);
  if (!EMAIL_SHAPE.test(normalized)) return { ok: false, reason: "invalid-email" };
  if (operators.includes(normalized)) return { ok: false, reason: "duplicate" };

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(allowlistEntry)
      .values({ email: normalized, addedByEmail: normalizeEmail(actorEmail) })
      .onConflictDoNothing()
      .returning();
    if (inserted.length === 0) return { ok: false, reason: "duplicate" } as const;
    await recordAudit(tx, { actorEmail: normalizeEmail(actorEmail), action: "allowlist.add", subjectType: "allowlist_entry", subjectId: normalized });
    return { ok: true, email: normalized } as const;
  });
}

export type RemoveResult = { ok: true } | { ok: false; reason: "operator" | "not-found" };

export async function removeAllowlistEntry(
  db: Db,
  actorEmail: string,
  email: string,
  operators: readonly string[],
  publish: Publish,
  now: Date = new Date(),
): Promise<RemoveResult> {
  const normalized = normalizeEmail(email);
  if (operators.includes(normalized)) return { ok: false, reason: "operator" };

  const removed = await db.transaction(async (tx) => {
    const rows = await tx.delete(allowlistEntry).where(eq(allowlistEntry.email, normalized)).returning();
    if (rows.length === 0) return false;
    await recordAudit(tx, { actorEmail: normalizeEmail(actorEmail), action: "allowlist.remove", subjectType: "allowlist_entry", subjectId: normalized });
    return true;
  });
  if (!removed) return { ok: false, reason: "not-found" };

  await endMemberAccess(db, normalized, now, publish);
  return { ok: true };
}

/**
 * Calls `onRevoked` for every `member.revoked` published by any web or
 * Gateway instance. Returns a function that stops listening.
 */
export async function listenMemberRevoked(url: string, onRevoked: (email: string) => void): Promise<() => Promise<void>> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  client.on("notification", (message) => {
    if (message.channel === MEMBER_REVOKED_CHANNEL && message.payload) onRevoked(message.payload);
  });
  await client.query(`listen ${MEMBER_REVOKED_CHANNEL}`);
  return () => client.end();
}

/** Every Member who ever signed in, allowed or not, for the Members page. */
export async function listMembers(db: Db): Promise<Member[]> {
  return db.select().from(member).orderBy(asc(member.email));
}

// Member lookups for the Auth.js adapter.

export async function findMemberById(db: Db, id: string): Promise<Member | null> {
  if (!isUuid(id)) return null;
  const [row] = await db.select().from(member).where(eq(member.id, id));
  return row ?? null;
}

export async function findMemberByEmail(db: Db, email: string): Promise<Member | null> {
  const [row] = await db.select().from(member).where(eq(member.email, normalizeEmail(email)));
  return row ?? null;
}

export async function findMemberByAccount(db: Db, provider: string, providerAccountId: string): Promise<Member | null> {
  const [row] = await db
    .select({ member })
    .from(memberAccount)
    .innerJoin(member, eq(member.id, memberAccount.memberId))
    .where(and(eq(memberAccount.provider, provider), eq(memberAccount.providerAccountId, providerAccountId)));
  return row?.member ?? null;
}

/** Links an OAuth account to a Member. Tokens are never passed in or kept. */
export async function linkMemberAccount(db: Db, link: { provider: string; providerAccountId: string; memberId: string }): Promise<void> {
  await db.insert(memberAccount).values(link).onConflictDoNothing();
}

export async function upsertMember(db: Db, profile: { email: string; name: string | null; pictureUrl: string | null }, now: Date) {
  const email = normalizeEmail(profile.email);
  const [row] = await db
    .insert(member)
    .values({ email, name: profile.name, pictureUrl: profile.pictureUrl, lastSignInAt: now })
    .onConflictDoUpdate({ target: member.email, set: { name: profile.name, pictureUrl: profile.pictureUrl } })
    .returning();
  return row!;
}

export async function updateMemberProfile(db: Db, id: string, profile: { name: string | null; pictureUrl: string | null }) {
  const [row] = await db.update(member).set(profile).where(eq(member.id, id)).returning();
  return row!;
}
