import type { Envelope } from "./envelope";
import type { MessageType, Payload } from "./messages";

export type ResumeState = { lastSentId: number; lastReceivedId: number };
export type Acceptance = "deliver" | "duplicate" | "gap";

/**
 * One side's half of resuming (RUN-12): numbers outgoing messages and keeps
 * them until the other side acknowledges them, and remembers the last id
 * received in order so a resent message is delivered exactly once.
 */
export class ResumeBuffer {
  lastSentId: number;
  lastReceivedId: number;
  private outbox: Envelope[] = [];

  constructor(state: Partial<ResumeState> = {}) {
    this.lastSentId = state.lastSentId ?? 0;
    this.lastReceivedId = state.lastReceivedId ?? 0;
  }

  next<T extends MessageType>(type: T, payload: Payload<T>, re?: number): Envelope<Payload<T>> {
    this.lastSentId += 1;
    const envelope: Envelope<Payload<T>> = re === undefined ? { id: this.lastSentId, type, payload } : { id: this.lastSentId, re, type, payload };
    this.outbox.push(envelope);
    return envelope;
  }

  acknowledge(upTo: number): void {
    this.outbox = this.outbox.filter((e) => e.id > upTo);
  }

  /** Messages sent but not acknowledged yet, oldest first. */
  pending(): readonly Envelope[] {
    return this.outbox;
  }

  /** Messages to resend after the other side reported `lastReceivedId`. */
  unacked(lastReceivedId: number): Envelope[] {
    this.acknowledge(lastReceivedId);
    return [...this.outbox];
  }

  /**
   * Decides whether a numbered message is new. Over one ordered socket, with
   * resending after welcome, ids only jump ahead when the sender restarted and
   * lost messages it can no longer resend. Waiting for them would stall the
   * link forever, so a gap is delivered too and reported for logging; Run
   * state lives in the database, not in lost messages.
   */
  accept(envelope: Envelope): Acceptance {
    if (envelope.id <= this.lastReceivedId) return "duplicate";
    const gap = envelope.id !== this.lastReceivedId + 1;
    this.lastReceivedId = envelope.id;
    return gap ? "gap" : "deliver";
  }

  state(): ResumeState {
    return { lastSentId: this.lastSentId, lastReceivedId: this.lastReceivedId };
  }
}
