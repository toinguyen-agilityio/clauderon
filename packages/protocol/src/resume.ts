import type { Envelope } from "./envelope.js";
import type { MessageType, Payload } from "./messages.js";

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

  /** Messages to resend after the other side reported `lastReceivedId`. */
  unacked(lastReceivedId: number): Envelope[] {
    this.acknowledge(lastReceivedId);
    return [...this.outbox];
  }

  /** Decides whether a numbered message is new; advances on delivery only. */
  accept(envelope: Envelope): Acceptance {
    if (envelope.id <= this.lastReceivedId) return "duplicate";
    if (envelope.id !== this.lastReceivedId + 1) return "gap";
    this.lastReceivedId = envelope.id;
    return "deliver";
  }

  state(): ResumeState {
    return { lastSentId: this.lastSentId, lastReceivedId: this.lastReceivedId };
  }
}
