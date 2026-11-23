import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { systemClock, type GitHubReader } from "@clauderon/core";
import { connect, notifyGatewayCommand, notifyMemberRevoked, parseOperatorEmails, type DbHandle } from "@clauderon/db";
import { SESSION_COOKIES, memberFromCookies } from "./access";
import type { AppDeps } from "./deps";
import { gitHubApi, withCachedPullRequests } from "./github";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// One pool per server instance, kept across hot reloads in development.
const globalForDb = globalThis as unknown as { clauderonDb?: DbHandle; clauderonGitHub?: GitHubReader };

export function deps(): AppDeps {
  globalForDb.clauderonDb ??= connect(required("DATABASE_URL"));
  globalForDb.clauderonGitHub ??= withCachedPullRequests(gitHubApi(process.env.GITHUB_TOKEN ?? ""));
  const { db } = globalForDb.clauderonDb;
  return {
    db,
    operators: parseOperatorEmails(process.env.OPERATOR_EMAILS),
    clock: systemClock,
    publish: notifyMemberRevoked(db),
    command: notifyGatewayCommand(db),
    github: globalForDb.clauderonGitHub,
  };
}

/** The web app's public origin (`AUTH_URL`), or the request's own when unset. */
export function webUrl(requestOrigin: string): string {
  return (process.env.AUTH_URL ?? requestOrigin).replace(/\/$/, "");
}

/** The web app's public origin for a page being rendered. */
export async function pageWebUrl(): Promise<string> {
  const h = await headers();
  return webUrl(`${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`);
}

/** The Gateway's public WebSocket origin, for browser sockets. */
export function gatewayUrl(): string {
  return (process.env.GATEWAY_URL ?? "ws://localhost:4000").replace(/\/$/, "");
}

export function sessionSecret(): string {
  return required("SESSION_SECRET");
}

/** A path inside this app to return to after sign-in; anything else is dropped. */
export function safeReturnPath(path: string | undefined | null): string | null {
  return path && path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : null;
}

/** The signed-in Member for a page; sends anyone else to sign in. */
export async function requireMember() {
  const store = await cookies();
  const live = await memberFromCookies(deps(), (name) => store.get(name)?.value);
  if (!live) {
    const hadCookie = SESSION_COOKIES.some((name) => store.has(name));
    redirect(hadCookie ? "/session-ended" : "/sign-in");
  }
  return live.member;
}
