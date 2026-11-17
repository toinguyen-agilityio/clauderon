import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseLimitCeiling, systemClock } from "@clauderon/core";
import { connect, notifyGatewayCommand, notifyMemberRevoked, parseOperatorEmails, type DbHandle } from "@clauderon/db";
import { SESSION_COOKIES, memberFromCookies } from "./access";
import type { AppDeps } from "./deps";
import { gitHubApi } from "./github";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// One pool per server instance, kept across hot reloads in development.
const globalForDb = globalThis as unknown as { clauderonDb?: DbHandle };

export function deps(): AppDeps {
  globalForDb.clauderonDb ??= connect(required("DATABASE_URL"));
  const { db } = globalForDb.clauderonDb;
  return {
    db,
    operators: parseOperatorEmails(process.env.OPERATOR_EMAILS),
    clock: systemClock,
    publish: notifyMemberRevoked(db),
    command: notifyGatewayCommand(db),
    github: gitHubApi(process.env.GITHUB_TOKEN ?? ""),
    podImage: process.env.POD_IMAGE ?? "",
    limitCeiling: parseLimitCeiling(process.env.POD_LIMIT_CEILING),
  };
}

/** The Gateway's public WebSocket origin, for browser sockets. */
export function gatewayUrl(): string {
  return (process.env.GATEWAY_URL ?? "ws://localhost:4000").replace(/\/$/, "");
}

export function sessionSecret(): string {
  return required("SESSION_SECRET");
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
