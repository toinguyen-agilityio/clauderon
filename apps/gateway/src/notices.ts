import { ticketKeys } from "@clauderon/core";
import { listProjects, memberLabel, runNotice, type Db } from "@clauderon/db";
import type { NotifyEvent, NotifyKind } from "@clauderon/protocol";

export type NoticeOptions = {
  /** The Node it is about: undefined for the latest Attempt's Node, null for none. */
  flowNodeId?: string | null;
  /** What a `needs_human` asks for. */
  request?: "approve" | "grill";
  /** Who acted, for another Member's action; the Starter is told, never the actor. */
  actorEmail?: string;
  /** The Starter as the web app read it; the Run's own Starter otherwise. */
  memberEmail?: string;
};

export type NotifyMember = (email: string, event: NotifyEvent) => void;

/**
 * Browser notifications for a Run's Starter (#198): builds the `notify` event
 * from the Run and sends it to the Starter's open tabs only. Nothing is kept:
 * a Member with no tab open misses it.
 */
export class RunNotices {
  constructor(private readonly opts: { db: Db; notifyMember: NotifyMember; log?: (message: string) => void }) {}

  async send(kind: NotifyKind, runId: string, options: NoticeOptions = {}): Promise<void> {
    try {
      const notice = await runNotice(this.opts.db, runId, options.flowNodeId);
      if (!notice) return;
      const keyOf = ticketKeys(await listProjects(this.opts.db));
      const event: NotifyEvent = {
        type: "notify",
        kind,
        runId,
        ticketKey: keyOf(notice.projectId, notice.ticketNumber),
        ticketTitle: notice.ticketTitle,
        flowName: notice.flowName,
        ...(notice.nodeName ? { nodeName: notice.nodeName } : {}),
        ...(options.request ? { request: options.request } : {}),
        ...(options.actorEmail ? { actor: await memberLabel(this.opts.db, options.actorEmail) } : {}),
      };
      this.opts.notifyMember(options.memberEmail ?? notice.starterEmail, event);
    } catch (error) {
      // A notification never stops the Run engine.
      this.opts.log?.(`notify: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
