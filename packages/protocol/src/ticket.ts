import { createHmac, timingSafeEqual } from "node:crypto";

// The browser opens its Gateway socket with a short-lived ticket from the web
// app, since the session cookie belongs to the web app's domain and is
// HTTP-only. The ticket names the session; the Gateway still loads the session
// and re-checks the allowlist.

export const GATEWAY_TICKET_SECONDS = 60;

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function createGatewayTicket(sessionId: string, now: Date, secret: string): string {
  const body = Buffer.from(JSON.stringify({ sid: sessionId, exp: now.getTime() + GATEWAY_TICKET_SECONDS * 1000 })).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

/** The session id the ticket names, or null when forged or expired. */
export function verifyGatewayTicket(ticket: string, now: Date, secret: string): string | null {
  const [body, signature] = ticket.split(".");
  if (!body || !signature) return null;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { sid, exp } = JSON.parse(Buffer.from(body, "base64url").toString()) as { sid: unknown; exp: unknown };
    if (typeof sid !== "string" || typeof exp !== "number" || exp < now.getTime()) return null;
    return sid;
  } catch {
    return null;
  }
}
