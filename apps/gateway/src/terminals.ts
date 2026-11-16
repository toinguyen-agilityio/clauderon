import { randomUUID } from "node:crypto";
import type { Clock } from "@clauderon/core";
import { getPod, recordAudit, type Db } from "@clauderon/db";
import { CloseCode, parseBrowserMessage, terminalRequest, type LinkSocket, type Payload, type TerminalEvent } from "@clauderon/protocol";
import type { BrowserHub } from "./browser-hub";
import type { Sender } from "./run-engine";

type Session = { socket: LinkSocket; podId: string; email: string; startedAt: Date; ended: boolean };

export type TerminalHubOptions = { db: Db; hub: BrowserHub; link: Sender; clock: Clock };

/**
 * Web terminals (spec M1 §2.5, POD-9): a browser socket on `/terminal` for
 * the Pod owner only, relayed to the Host Agent as `terminal.*` messages.
 * Sockets are registered with the BrowserHub, so removing the owner's email
 * closes them, which closes the shell (A7). Audit keeps open and close times,
 * never keystrokes or output.
 */
export class TerminalHub {
  private sessions = new Map<string, Session>();

  constructor(private readonly opts: TerminalHubOptions) {}

  async attach(socket: LinkSocket, ticket: string | null | undefined, podId: string | null, size: { cols?: number; rows?: number } = {}): Promise<string | null> {
    const pending: string[] = [];
    let sessionId: string | null = null;
    socket.onMessage((text) => (sessionId ? this.input(sessionId, text) : pending.push(text)));

    const member = await this.opts.hub.authenticate(socket, ticket);
    if (!member) return null;
    const pod = podId ? await getPod(this.opts.db, podId) : null;
    if (!pod || pod.memberId !== member.id) {
      socket.close(CloseCode.NotFound, "not found");
      return null;
    }

    const id = randomUUID();
    const session: Session = { socket, podId: pod.id, email: member.email, startedAt: this.opts.clock.now(), ended: false };
    this.sessions.set(id, session);
    socket.onClose(() => {
      if (session.ended) return;
      this.opts.link.send("terminal.close", { sessionId: id, podId: pod.id });
      // Audit and check now: the Host Agent's reply may never come while it is offline.
      void this.end(id).catch(() => {});
    });
    await recordAudit(this.opts.db, {
      actorEmail: member.email,
      action: "terminal.open",
      subjectType: "pod",
      subjectId: pod.id,
      detail: { sessionId: id, at: session.startedAt.toISOString() },
    });
    this.opts.link.send("terminal.open", { sessionId: id, podId: pod.id, cols: size.cols ?? 80, rows: size.rows ?? 24 });
    sessionId = id;
    pending.splice(0).forEach((text) => this.input(id, text));
    return id;
  }

  private input(sessionId: string, text: string): void {
    const session = this.sessions.get(sessionId);
    const request = parseBrowserMessage(terminalRequest, text);
    if (!session || !request) return;
    if (request.type === "input") this.opts.link.send("terminal.input", { sessionId, podId: session.podId, data: request.data });
    else this.opts.link.send("terminal.resize", { sessionId, podId: session.podId, cols: request.cols, rows: request.rows });
  }

  output({ sessionId, data }: Payload<"terminal.output">): void {
    if (data) this.sessions.get(sessionId)?.socket.send(JSON.stringify({ type: "output", data } satisfies TerminalEvent));
  }

  /** The shell ended by itself: close the browser side too. */
  async closed({ sessionId }: Payload<"terminal.closed">): Promise<void> {
    await this.end(sessionId);
  }

  /** Ends a session once: close the browser side, audit, and check the logins (POD-5). */
  private async end(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.ended) return;
    this.sessions.delete(sessionId);
    session.ended = true;
    session.socket.close(1000, "terminal closed");
    await recordAudit(this.opts.db, {
      actorEmail: session.email,
      action: "terminal.close",
      subjectType: "pod",
      subjectId: session.podId,
      detail: { sessionId, startedAt: session.startedAt.toISOString(), endedAt: this.opts.clock.now().toISOString() },
    });
    this.opts.link.send("pod.checkLogins", { podId: session.podId });
  }

  count(): number {
    return this.sessions.size;
  }
}
