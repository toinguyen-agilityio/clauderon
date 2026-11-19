import type { Clock, TimerHandle } from "@clauderon/core";
import {
  CloseCode,
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

/** What a hello tells about the Machine (spec M0 §8, ADR 0006). */
export type MachineFacts = { os: string; arch: string; hostname: string; cpus: number; memoryMb: number; diskGb: number };
export type MachineFactsReader = () => Promise<MachineFacts>;

/** Where the Agent keeps its last received id between restarts. */
export interface StateStore {
  load(): Promise<{ lastReceivedId: number }>;
  save(state: { lastReceivedId: number }): Promise<void>;
}

type Handler<T extends MessageType> = (payload: Payload<T>, envelope: Envelope<Payload<T>>) => void | Promise<void>;

export type AgentOptions = {
  url: string;
  /** The Machine's token from Pairing. */
  token: string;
  clock: Clock;
  connect: Connector;
  facts: MachineFactsReader;
  state: StateStore;
  processId: string;
  version: string;
  log?: (message: string) => void;
  /** Attempts whose Node process is running here (spec M3 §6). */
  runningAttempts?: () => readonly string[];
  /** After every welcome: e.g. kill orphaned Node processes. */
  onWelcome?: () => void | Promise<void>;
  /** The Gateway refused the token (unknown, or replaced by a new Pairing): the Agent has stopped. */
  onUnpaired?: (code: number) => void;
};

/**
 * The Agent's end of the link (spec M0 §4, ADR 0006): connects out to the
 * Gateway with its Machine's token, says hello with the Machine's facts, resumes from message ids, sends a
 * heartbeat every 10 s and reconnects with backoff 1, 2, 4 … capped at 10 s,
 * forever (NFR-3), until the Gateway refuses the token. It only executes and
 * reports; the handlers do the work.
 */
export class Agent {
  private buffer = new ResumeBuffer();
  private socket: LinkSocket | null = null;
  private welcomed = false;
  private failures = 0;
  private heartbeat: TimerHandle | null = null;
  private reconnect: TimerHandle | null = null;
  private stopped = false;
  private handlers = new Map<string, Handler<MessageType>[]>();
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly opts: AgentOptions) {}

  async start(): Promise<void> {
    const saved = await this.opts.state.load();
    this.buffer = new ResumeBuffer({ lastReceivedId: saved.lastReceivedId });
    await this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.stopHeartbeat();
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
      socket = await this.opts.connect(`${this.opts.url.replace(/\/$/, "")}/agent`, {
        authorization: `Bearer ${this.opts.token}`,
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
      this.stopHeartbeat();
      if (code === CloseCode.Unauthorized || code === CloseCode.Revoked) {
        // Reconnecting cannot help: only a new Pairing can.
        this.stopped = true;
        this.opts.onUnpaired?.(code);
        return;
      }
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
          liveAttempts: this.liveAttempts(),
        }),
      ),
    );
  }

  /**
   * Attempts not reported yet (spec M3 §6): running here, or finished with a
   * `node.result` the Gateway has not acknowledged. The Gateway treats any
   * other running Attempt as lost after a restart.
   */
  liveAttempts(): string[] {
    const live = new Set(this.opts.runningAttempts?.() ?? []);
    for (const envelope of this.buffer.pending()) {
      if (envelope.type === "node.result") live.add((envelope.payload as Payload<"node.result">).attemptId);
    }
    return [...live];
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnect) return;
    const delay = Math.min(BACKOFF_START_MS * 2 ** this.failures, BACKOFF_CAP_MS);
    this.failures++;
    this.reconnect = this.opts.clock.setTimeout(() => void this.connect(), delay);
  }

  private beat(): void {
    this.heartbeat = this.opts.clock.setTimeout(() => {
      this.beat();
      this.sendHeartbeat();
    }, HEARTBEAT_MS);
  }

  private sendHeartbeat(): void {
    this.socket?.send(serialize(controlMessage("heartbeat", { at: this.opts.clock.now().toISOString() })));
  }

  private stopHeartbeat(): void {
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
      this.stopHeartbeat();
      this.beat();
      for (const missed of this.buffer.unacked((envelope.payload as Payload<"welcome">).lastReceivedId)) socket.send(serialize(missed));
      if (this.opts.onWelcome) void Promise.resolve(this.opts.onWelcome()).catch((error: unknown) => this.log(`after welcome: ${String(error)}`));
      return;
    }
    if (envelope.type === "ack") {
      this.buffer.acknowledge((envelope.payload as Payload<"ack">).upTo);
      return;
    }
    if (envelope.id === 0) return;

    const acceptance = this.buffer.accept(envelope);
    if (acceptance === "gap") this.log(`message ids jumped to ${envelope.id}: the sender lost earlier messages`);
    if (acceptance !== "duplicate") {
      await this.opts.state.save({ lastReceivedId: this.buffer.lastReceivedId });
      if (parsed.known && isMessageType(envelope.type)) {
        for (const handler of this.handlers.get(envelope.type) ?? []) await handler(envelope.payload as never, envelope as never);
      } else {
        this.log(`unknown message type ${envelope.type}, acknowledged`);
      }
    }
    socket.send(serialize(controlMessage("ack", { upTo: this.buffer.lastReceivedId })));
  }

  private log(message: string): void {
    (this.opts.log ?? console.log)(message);
  }
}
