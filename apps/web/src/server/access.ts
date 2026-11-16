import type { Clock } from "@clauderon/core";
import {
  addAllowlistEntry,
  isOperator,
  listAllowlist,
  loadSession,
  removeAllowlistEntry,
  signIn,
  type AddResult,
  type AllowlistRow,
  type Db,
  type Member,
  type Publish,
  type RemoveResult,
} from "@clauderon/db";

// The app's access rules as plain functions over the database, so tests drive
// them directly (spec "test seam") and pages, actions and routes stay thin.

export const SESSION_COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"] as const;

export type AccessDeps = { db: Db; operators: readonly string[]; clock: Clock; publish: Publish };

export type GoogleSignIn = { email?: string | null; email_verified?: boolean | null; name?: string | null; picture?: string | null };

/** The Auth.js signIn callback: allowed, or the reason to show access denied. */
export async function checkGoogleSignIn(
  deps: Pick<AccessDeps, "db" | "operators" | "clock">,
  profile: GoogleSignIn | undefined,
): Promise<{ ok: true } | { ok: false; email: string | null }> {
  if (!profile?.email) return { ok: false, email: null };
  const result = await signIn(
    deps.db,
    { email: profile.email, emailVerified: profile.email_verified === true, name: profile.name ?? null, picture: profile.picture ?? null },
    deps.operators,
    deps.clock.now(),
  );
  return result.ok ? { ok: true } : { ok: false, email: profile.email };
}

/** The signed-in Member for a request's cookies, re-checking the allowlist. */
export async function memberFromCookies(deps: Pick<AccessDeps, "db" | "operators" | "clock">, read: (name: string) => string | undefined) {
  for (const name of SESSION_COOKIES) {
    const token = read(name);
    if (token) return loadSession(deps.db, token, deps.operators, deps.clock.now());
  }
  return null;
}

export type AllowlistView = { rows: AllowlistRow[] } | "not-found";

/** The Allowlist page is the Operator's; anyone else gets 404 (MEM-4). */
export async function viewAllowlist(deps: AccessDeps, viewer: Member): Promise<AllowlistView> {
  if (!isOperator(viewer.email, deps.operators)) return "not-found";
  return { rows: await listAllowlist(deps.db, deps.operators) };
}

export async function addToAllowlist(deps: AccessDeps, actor: Member, email: string): Promise<AddResult | "not-found"> {
  if (!isOperator(actor.email, deps.operators)) return "not-found";
  return addAllowlistEntry(deps.db, actor.email, email, deps.operators);
}

export async function removeFromAllowlist(deps: AccessDeps, actor: Member, email: string): Promise<RemoveResult | "not-found"> {
  if (!isOperator(actor.email, deps.operators)) return "not-found";
  return removeAllowlistEntry(deps.db, actor.email, email, deps.operators, deps.publish, deps.clock.now());
}
