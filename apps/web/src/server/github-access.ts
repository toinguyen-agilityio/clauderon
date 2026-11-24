import { getGitHubAccess, removeGitHubAccess, setGitHubAccess, type Db } from "@clauderon/db";
import type { AppDeps, Viewer } from "./deps";
import { GitHubError } from "./github";
import { canManageProjects, forgetSyncAttempts } from "./projects";
import { seal, unseal } from "./secret-box";

// The app's GitHub token (PRJ-2, ADR 0010): only an Operator sets, replaces or
// removes it, on the Projects page. It is stored sealed and never shown again;
// the page shows its GitHub login and last four characters.

export type GitHubAccessDeps = AppDeps & {
  /** Seals the stored token (`SESSION_SECRET`). */
  sessionSecret: string;
  /** The GitHub login of a token; throws when GitHub refuses it. */
  gitHubLogin: (token: string) => Promise<string>;
};

export type GitHubAccessView = { login: string; last4: string; setByEmail: string; setAt: Date } | null;

export async function viewGitHubAccess(deps: AppDeps): Promise<GitHubAccessView> {
  const access = await getGitHubAccess(deps.db);
  return access && { login: access.login, last4: access.tokenLast4, setByEmail: access.setByEmail, setAt: access.setAt };
}

/** The token every GitHub read uses; throws a message the pages show when it is missing or unreadable. */
export async function appGitHubToken(db: Db, sessionSecret: string): Promise<string> {
  const access = await getGitHubAccess(db);
  if (!access) throw new GitHubError("GitHub: no token is set. An Operator adds one on the Projects page.", 0);
  const token = unseal(access.tokenSealed, sessionSecret);
  if (!token) throw new GitHubError("GitHub: the saved token cannot be read since SESSION_SECRET changed. An Operator sets it again on the Projects page.", 0);
  return token;
}

export type SaveTokenResult = { ok: true; login: string } | { ok: false; error: string };

/** Checks a token with GitHub, then stores it sealed in place of the old one. */
export async function saveGitHubToken(deps: GitHubAccessDeps, viewer: Viewer, input: string): Promise<SaveTokenResult | "not-found"> {
  if (!canManageProjects(deps, viewer)) return "not-found";
  const token = input.trim();
  if (!token) return { ok: false, error: "Paste a token." };
  if (/\s/.test(token)) return { ok: false, error: "A token has no spaces or line breaks." };
  let login: string;
  try {
    login = await deps.gitHubLogin(token);
  } catch (error) {
    if (error instanceof GitHubError && error.status === 401) return { ok: false, error: "GitHub refused that token: it is invalid, expired or revoked." };
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  await setGitHubAccess(deps.db, viewer.email, { tokenSealed: seal(token, deps.sessionSecret), tokenLast4: token.slice(-4), login }, deps.clock.now());
  // Projects that failed without a token are read again on the next Tickets visit.
  forgetSyncAttempts();
  return { ok: true, login };
}

export async function removeGitHubToken(deps: AppDeps, viewer: Viewer): Promise<boolean | "not-found"> {
  if (!canManageProjects(deps, viewer)) return "not-found";
  return removeGitHubAccess(deps.db, viewer.email);
}
