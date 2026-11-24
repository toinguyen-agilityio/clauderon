import { eq } from "drizzle-orm";
import type { Db } from "./client";
import { recordAudit } from "./access";
import { githubAccess } from "./schema";

// The app's GitHub token (PRJ-2, ADR 0010). This module only stores what the
// web app hands it: the token arrives sealed and is never decrypted here.

export type GitHubAccess = typeof githubAccess.$inferSelect;

export async function getGitHubAccess(db: Db): Promise<GitHubAccess | null> {
  const [row] = await db.select().from(githubAccess).where(eq(githubAccess.singleton, true));
  return row ?? null;
}

/** Sets or replaces the token. The audit entry names the GitHub login, never the token. */
export async function setGitHubAccess(
  db: Db,
  actorEmail: string,
  access: { tokenSealed: string; tokenLast4: string; login: string },
  now: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    const values = { ...access, setByEmail: actorEmail, setAt: now };
    await tx.insert(githubAccess).values(values).onConflictDoUpdate({ target: githubAccess.singleton, set: values });
    await recordAudit(tx, { actorEmail, action: "github.token.set", subjectType: "github", subjectId: "app", detail: { login: access.login } });
  });
}

/** Removes the token; returns whether there was one. */
export async function removeGitHubAccess(db: Db, actorEmail: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const removed = await tx.delete(githubAccess).returning({ login: githubAccess.login });
    if (removed.length === 0) return false;
    await recordAudit(tx, { actorEmail, action: "github.token.remove", subjectType: "github", subjectId: "app", detail: { login: removed[0]!.login } });
    return true;
  });
}
