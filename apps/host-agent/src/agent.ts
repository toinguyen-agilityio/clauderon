import type { Clock, TimerHandle } from "@clauderon/core";
import {
  ResumeBuffer,
  controlMessage,
  isMessageType,
  parseEnvelope,
  serialize,
  type Envelope,
  type LinkSocket,
  type MessageType,
  type Payload,
} from "@clauderon/protocol";

export const HEARTBEAT_MS = 10_000;
export const BACKOFF_START_MS = 1_000;
export const BACKOFF_CAP_MS = 10_000;

/** Opens the WebSocket; resolves once it is open, rejects if it cannot be. */
export type Connector = (url: string, headers: Record<string, string>) => Promise<LinkSocket>;

export type HostFacts = { arch: string; cpus: number; memoryMb: number; diskGb: number; dockerRunning: boolean };
export type HostFactsReader = () => Promise<HostFacts>;

/** Where the Host Agent keeps its last received id between restarts. */
export interface StateStore {
  load(): Promise<{ lastReceivedId: number }>;
  save(state: { lastReceivedId: number }): Promise<void>;
}

type Handler<T extends MessageType> = (payload: Payload<T>, envelope: Envelope<Payload<T>>) => void | Promise<void>;

export type HostAgentOptions = {
  url: string;
  secret: string;
  clock: Clock;
  connect: Connector;
  facts: HostFactsReader;
  state: StateStore;
  processId: string;
  version: string;
  log?: (message: string) => void;
};

/**
 * The Host Agent's end of the link (spec M0 §4): connects out to the Gateway,
 * says hello with the host's facts, resumes from message ids, sends a
 * heartbeat every 10 s and reconnects with backoff 1, 2, 4 … capped at 10 s,
 * forever (NFR-3). It only executes and reports; M1 adds the handlers.
 */
export class HostAgent {
  private buffer = new ResumeBuffer();
  private socket: LinkSocket | null = null;
  private welcomed = false;
  private failures = 0;
  private heartbeat: TimerHandle | null = null;
  private reconnect: TimerHandle | null = null;
  private stopped = false;
  private handlers = new Map<string, Handler<MessageType>[]>();
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly opts: HostAgentOptions) {}

  async start(): Promise<void> {
    const saved = await this.opts.state.load();
    this.buffer = new ResumeBuffer({ lastReceivedId: saved.lastReceivedId });
    await this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.clearTimers();
    this.socket?.close(1000, "stopping");
  }

  on<T extends MessageType>(type: T, handler: Handler<T>): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler as Handler<MessageType>);
    this.handlers.set(type, list);
  }

  /** Sends a numbered message now, or after the next welcome. */
  send<T extends MessageType>(type: T, payload: Payload<T>, re?: number): Envelope {
    const envelope = this.buffer.next(type, payload, re);
    if (this.welcomed) this.socket?.send(serialize(envelope));
    return envelope;
  }

  private async connect(): Promise<void> {
    this.reconnect = null;
    if (this.stopped) return;
    let socket: LinkSocket;
    try {
      socket = await this.opts.connect(`${this.opts.url.replace(/\/$/, "")}/host-agent`, {
        authorization: `Bearer ${this.opts.secret}`,
      });
    } catch (error) {
      this.log(`connect failed: ${String(error)}`);
      this.scheduleReconnect();
      return;
    }

    this.socket = socket;
    this.welcomed = false;
    socket.onMessage((text) => this.enqueue(() => this.handle(socket, text)));
    socket.onClose((code) => {
      if (this.socket !== socket) return;
      this.log(`disconnected (${code})`);
      this.socket = null;
      this.welcomed = false;
      this.clearTimers();
      this.scheduleReconnect();
    });

    const facts = await this.opts.facts();
    socket.send(
      serialize(
        controlMessage("hello", {
          agentVersion: this.opts.version,
          processId: this.opts.processId,
          ...facts,
          lastReceivedId: this.buffer.lastReceivedId,
          liveAttempts: [],
        }),
      ),
    );
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnect) return;
    const delay = Math.min(BACKOFF_START_MS * 2 ** this.failures, BACKOFF_CAP_MS);
    this.failures++;
    this.reconnect = this.opts.clock.setTimeout(() => void this.connect(), delay);
  }

  private beat(): void {
    this.heartbeat = this.opts.clock.setTimeout(() => {
      this.socket?.send(serialize(controlMessage("heartbeat", { at: this.opts.clock.now().toISOString(), pods: [] })));
      this.beat();
    }, HEARTBEAT_MS);
  }

  private clearTimers(): void {
    if (this.heartbeat) this.opts.clock.clearTimeout(this.heartbeat);
    this.heartbeat = null;
  }

  private enqueue(task: () => Promise<void>): void {
    this.queue = this.queue.then(task).catch((error: unknown) => this.log(`error: ${String(error)}`));
  }

  private async handle(socket: LinkSocket, text: string): Promise<void> {
    const parsed = parseEnvelope(text);
    if (!parsed.ok) {
      this.log(`dropped message: ${parsed.error}`);
      return;
    }
    const { envelope } = parsed;

    if (envelope.type === "welcome") {
      this.welcomed = true;
      this.failures = 0;
      this.clearTimers();
      this.beat();
      for (const missed of this.buffer.unacked((envelope.payload as Payload<"welcome">).lastReceivedId)) socket.send(serialize(missed));
      return;
    }
    if (envelope.type === "ack") {
      this.buffer.acknowledge((envelope.payload as Payload<"ack">).upTo);
      return;
    }
    if (envelope.id === 0) return;

    const acceptance = this.buffer.accept(envelope);
    if (acceptance === "deliver") {
      await this.opts.state.save({ lastReceivedId: this.buffer.lastReceivedId });
      if (parsed.known && isMessageType(envelope.type)) {
        for (const handler of this.handlers.get(envelope.type) ?? []) await handler(envelope.payload as never, envelope as never);
      } else {
        this.log(`unknown message type ${envelope.type}, acknowledged`);
      }
    }
    if (acceptance !== "gap") socket.send(serialize(controlMessage("ack", { upTo: this.buffer.lastReceivedId })));
  }

  private log(message: string): void {
    (this.opts.log ?? console.log)(message);
  }
}
