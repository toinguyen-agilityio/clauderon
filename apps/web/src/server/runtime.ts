import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { systemClock } from "@clauderon/core";
import { connect, notifyMemberRevoked, parseOperatorEmails, type DbHandle } from "@clauderon/db";
import { SESSION_COOKIES, memberFromCookies, type AccessDeps } from "./access";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// One pool per server instance, kept across hot reloads in development.
const globalForDb = globalThis as unknown as { clauderonDb?: DbHandle };

export function deps(): AccessDeps {
  globalForDb.clauderonDb ??= connect(required("DATABASE_URL"));
  const { db } = globalForDb.clauderonDb;
  return { db, operators: parseOperatorEmails(process.env.OPERATOR_EMAILS), clock: systemClock, publish: notifyMemberRevoked(db) };
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
