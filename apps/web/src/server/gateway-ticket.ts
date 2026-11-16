import { createGatewayTicket } from "@clauderon/protocol";
import { SESSION_COOKIES, memberFromCookies, type AccessDeps } from "./access";

export type TicketResult = { status: 200; ticket: string } | { status: 401; clearCookies: boolean };

/**
 * A short-lived ticket the browser presents when it opens its Gateway socket.
 * A stale or revoked session gets 401, and its cookie is cleared (MEM-3).
 */
export async function gatewayTicket(
  deps: Pick<AccessDeps, "db" | "operators" | "clock">,
  readCookie: (name: string) => string | undefined,
  sessionSecret: string,
): Promise<TicketResult> {
  const live = await memberFromCookies(deps, readCookie);
  if (!live) {
    const hadCookie = SESSION_COOKIES.some((name) => readCookie(name) !== undefined);
    return { status: 401, clearCookies: hadCookie };
  }
  return { status: 200, ticket: createGatewayTicket(live.session.id, deps.clock.now(), sessionSecret) };
}
