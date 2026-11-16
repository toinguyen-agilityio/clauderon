import type { Clock } from "@clauderon/core";
import { loadSessionById, normalizeEmail, type Db, type Member } from "@clauderon/db";
import { CloseCode, verifyGatewayTicket, type LinkSocket } from "@clauderon/protocol";
import type { LiveHub } from "./live-hub";

export type BrowserHubOptions = {
  db: Db;
  operators: readonly string[];
  sessionSecret: string;
  clock: Clock;
  /** Live logs and Run changes for `/browser` sockets (M1). */
  live?: LiveHub;
};

/**
 * Browser sockets, grouped by Member. Each socket opens with a ticket from
 * the web app; the session behind it is loaded and the allowlist re-checked.
 * `revoke` is the hook of spec M0 §7.1: terminals and live log sockets are
 * registered here too, so removing an email closes them at once (A7).
 */
export class BrowserHub {
  private sockets = new Map<string, Set<LinkSocket>>();

  constructor(private readonly opts: BrowserHubOptions) {}

  /** A `/browser` socket: live logs and Run changes once authenticated. */
  async attach(socket: LinkSocket, ticket: string | null | undefined): Promise<Member | null> {
    const live = this.opts.live;
    // The browser subscribes as soon as the socket opens: hold its messages
    // until the session is checked.
    const pending: string[] = [];
    let ready = false;
    const handle = (text: string) => void live?.handle(socket, text).catch(() => {});
    socket.onMessage((text) => (ready ? handle(text) : pending.push(text)));
    const member = await this.authenticate(socket, ticket);
    if (member && live) {
      ready = true;
      socket.onClose(() => live.drop(socket));
      pending.splice(0).forEach(handle);
    }
    return member;
  }

  /**
   * Checks the socket's ticket and registers it under its Member, or closes
   * it with 4401. Returns the Member, or null.
   */
  async authenticate(socket: LinkSocket, ticket: string | null | undefined): Promise<Member | null> {
    let closed = false;
    socket.onClose(() => {
      closed = true;
    });

    const now = this.opts.clock.now();
    const sessionId = ticket ? verifyGatewayTicket(ticket, now, this.opts.sessionSecret) : null;
    const live = sessionId ? await loadSessionById(this.opts.db, sessionId, this.opts.operators, now) : null;
    if (!live) {
      socket.close(CloseCode.Unauthorized, "unauthorized");
      return null;
    }
    if (closed) return null;

    const email = live.member.email;
    const set = this.sockets.get(email) ?? new Set();
    set.add(socket);
    this.sockets.set(email, set);
    socket.onClose(() => {
      set.delete(socket);
      if (set.size === 0 && this.sockets.get(email) === set) this.sockets.delete(email);
    });
    return live.member;
  }

  /** Closes every socket of the Member with 4403 (MEM-3). */
  revoke(email: string): void {
    const normalized = normalizeEmail(email);
    const set = this.sockets.get(normalized);
    if (!set) return;
    this.sockets.delete(normalized);
    for (const socket of set) socket.close(CloseCode.Revoked, "access removed");
  }

  count(email: string): number {
    return this.sockets.get(normalizeEmail(email))?.size ?? 0;
  }
}
