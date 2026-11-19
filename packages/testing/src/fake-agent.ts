import type { Clock, TimerHandle } from "@clauderon/core";
import {
  ResumeBuffer,
  controlMessage,
  parseEnvelope,
  serialize,
  type Envelope,
  type LinkSocket,
  type MessageType,
  type Payload,
} from "@clauderon/protocol";

export type HelloOverrides = Partial<Payload<"hello">>;

/** A scripted reply to one Gateway message type. */
export type Responder<T extends MessageType> = (payload: Payload<T>, agent: FakeAgent) => void;

/**
 * Speaks the real Agent protocol from a test (spec "test seam"): sends
 * hello, resends what the Gateway missed, acknowledges and records what it
 * receives. Scripted per test; later milestones add Node behaviour.
 */
export class FakeAgent {
  readonly buffer = new ResumeBuffer();
  /** Numbered messages from the Gateway, each delivered once, in order. */
  readonly received: Envelope[] = [];
  welcome: Payload<"welcome"> | null = null;
  closeCode: number | null = null;
  autoAck = true;
  private socket: LinkSocket | null = null;
  private responders = new Map<string, Responder<MessageType>>();
  private beat: { clock: Clock; timer: TimerHandle; everyMs: number } | null = null;

  constructor(private readonly processId = "fake-process-1") {}

  connect(socket: LinkSocket, hello: HelloOverrides = {}): void {
    this.socket = socket;
    this.welcome = null;
    this.closeCode = null;
    socket.onMessage((text) => this.handle(text));
    socket.onClose((code) => {
      this.closeCode = code;
      if (this.socket === socket) this.socket = null;
    });
    socket.send(
      serialize(
        controlMessage("hello", {
          agentVersion: "0.0.0-fake",
          processId: this.processId,
          os: "darwin",
          arch: "arm64",
          hostname: "fake-mac",
          cpus: 8,
          memoryMb: 16384,
          diskGb: 256,
          lastReceivedId: this.buffer.lastReceivedId,
          liveAttempts: [],
          ...hello,
        }),
      ),
    );
  }

  /** Scripts the reply to a message type (spec "test seam"): succeed, fail, stream logs. */
  respond<T extends MessageType>(type: T, responder: Responder<T>): this {
    this.responders.set(type, responder as Responder<MessageType>);
    return this;
  }

  /** Numbered messages of one type received so far. */
  of<T extends MessageType>(type: T): Payload<T>[] {
    return this.received.filter((e) => e.type === type).map((e) => e.payload as Payload<T>);
  }

  send<T extends MessageType>(type: T, payload: Payload<T>): Envelope {
    const envelope = this.buffer.next(type, payload);
    this.socket?.send(serialize(envelope));
    return envelope;
  }

  heartbeat(at = new Date().toISOString()): void {
    this.socket?.send(serialize(controlMessage("heartbeat", { at })));
  }

  /** Heartbeats on a (fake) clock while connected, as the real Agent does every 10 s. */
  beatEvery(clock: Clock, everyMs = 10_000): void {
    this.stopBeating();
    const tick = () => {
      if (this.welcome) this.heartbeat(clock.now().toISOString());
      this.beat = { clock, everyMs, timer: clock.setTimeout(tick, everyMs) };
    };
    this.beat = { clock, everyMs, timer: clock.setTimeout(tick, everyMs) };
  }

  stopBeating(): void {
    if (this.beat) this.beat.clock.clearTimeout(this.beat.timer);
    this.beat = null;
  }

  ack(): void {
    this.socket?.send(serialize(controlMessage("ack", { upTo: this.buffer.lastReceivedId })));
  }

  get connected(): boolean {
    return this.socket !== null;
  }

  private handle(text: string): void {
    const parsed = parseEnvelope(text);
    if (!parsed.ok) return;
    const { envelope } = parsed;
    if (envelope.type === "welcome") {
      this.welcome = envelope.payload as Payload<"welcome">;
      for (const missed of this.buffer.unacked(this.welcome.lastReceivedId)) this.socket?.send(serialize(missed));
      return;
    }
    if (envelope.type === "ack") {
      this.buffer.acknowledge((envelope.payload as Payload<"ack">).upTo);
      return;
    }
    if (envelope.id === 0) return;
    const fresh = this.buffer.accept(envelope) !== "duplicate";
    if (fresh) this.received.push(envelope);
    if (this.autoAck) this.ack();
    if (fresh) this.responders.get(envelope.type)?.(envelope.payload as never, this);
  }
}
