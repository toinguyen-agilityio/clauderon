import type { Clock } from "@clauderon/core";
import { loadSessionById, normalizeEmail, type Db } from "@clauderon/db";
import { CloseCode, verifyGatewayTicket, type LinkSocket } from "@clauderon/protocol";

export type BrowserHubOptions = {
  db: Db;
  operators: readonly string[];
  sessionSecret: string;
  clock: Clock;
};

/**
 * Browser sockets, grouped by Member. Each socket opens with a ticket from
 * the web app; the session behind it is loaded and the allowlist re-checked.
 * `revoke` is the hook of spec M0 §7.1: M1 attaches terminals and live logs.
 */
export class BrowserHub {
  private sockets = new Map<string, Set<LinkSocket>>();

  constructor(private readonly opts: BrowserHubOptions) {}

  async attach(socket: LinkSocket, ticket: string | null | undefined): Promise<string | null> {
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
    return email;
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
