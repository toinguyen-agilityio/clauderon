import { timingSafeEqual } from "node:crypto";
import type { Clock } from "@clauderon/core";
import { getPodHost, recordHeartbeat, recordHostConnected, recordHostDisconnected, saveLinkIds, type Db } from "@clauderon/db";
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

type Handler<T extends MessageType> = (payload: Payload<T>, envelope: Envelope<Payload<T>>) => void | Promise<void>;
/** A `hello`: whether the Host Agent process changed since the one the Gateway last knew. */
export type HelloListener = (hello: Payload<"hello">, info: { processChanged: boolean }) => void | Promise<void>;
export type HeartbeatListener = (heartbeat: Payload<"heartbeat">) => void | Promise<void>;

export type HostLinkOptions = {
  db: Db;
  secret: string;
  podImage: string;
  clock: Clock;
  log?: (message: string) => void;
};

/**
 * The Gateway's end of the one Host Agent WebSocket (spec M0 §4): checks the
 * secret, answers hello with welcome, resends what the Host Agent missed,
 * acknowledges and delivers each numbered message once, records heartbeats.
 * Messages are handled one at a time, in arrival order.
 */
export class HostLink {
  private buffer = new ResumeBuffer();
  private current: LinkSocket | null = null;
  private processId: string | null = null;
  private handlers = new Map<string, Handler<MessageType>[]>();
  private queue: Promise<void> = Promise.resolve();
  private helloListeners: HelloListener[] = [];
  private heartbeatListeners: HeartbeatListener[] = [];

  constructor(private readonly opts: HostLinkOptions) {}

  /** Called after each `welcome` and the resent messages (spec M3 §6). */
  onHello(listener: HelloListener): void {
    this.helloListeners.push(listener);
  }

  onHeartbeat(listener: HeartbeatListener): void {
    this.heartbeatListeners.push(listener);
  }

  /** Closes the current socket, e.g. a silent one; the Host Agent reconnects with a hello. */
  drop(reason: string): void {
    const socket = this.current;
    if (!socket) return;
    this.current = null;
    socket.close(CloseCode.Silent, reason);
    this.enqueue(() => recordHostDisconnected(this.opts.db));
  }

  /** Loads the persisted message ids; call once before accepting sockets. */
  async start(): Promise<void> {
    const host = await getPodHost(this.opts.db);
    this.buffer = new ResumeBuffer({ lastSentId: host?.lastSentId ?? 0, lastReceivedId: host?.lastReceivedId ?? 0 });
    this.processId = host?.processId ?? null;
    // No socket survives a Gateway restart: show disconnected until hello.
    if (host?.connected) await recordHostDisconnected(this.opts.db);
  }

  get connected(): boolean {
    return this.current !== null;
  }

  on<T extends MessageType>(type: T, handler: Handler<T>): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler as Handler<MessageType>);
    this.handlers.set(type, list);
  }

  attach(socket: LinkSocket, authorization: string | undefined): void {
    if (!this.authorized(authorization)) {
      socket.close(CloseCode.Unauthorized, "unauthorized");
      return;
    }
    socket.onMessage((text) => this.enqueue(() => this.handle(socket, text)));
    socket.onClose(() =>
      this.enqueue(async () => {
        if (this.current !== socket) return;
        this.current = null;
        await recordHostDisconnected(this.opts.db);
      }),
    );
  }

  /** Sends a numbered message now, or on the next connection if none is open. */
  send<T extends MessageType>(type: T, payload: Payload<T>, re?: number): Envelope {
    const envelope = this.buffer.next(type, payload, re);
    this.current?.send(serialize(envelope));
    this.enqueue(() => this.persistIds());
    return envelope;
  }

  /** Resolves once every message received so far has been handled. */
  idle(): Promise<void> {
    return this.queue;
  }

  private authorized(authorization: string | undefined): boolean {
    const expected = Buffer.from(`Bearer ${this.opts.secret}`);
    const given = Buffer.from(authorization ?? "");
    return this.opts.secret.length > 0 && expected.length === given.length && timingSafeEqual(expected, given);
  }

  private enqueue(task: () => Promise<void>): void {
    this.queue = this.queue.then(task).catch((error: unknown) => this.log(`host link error: ${String(error)}`));
  }

  private async handle(socket: LinkSocket, text: string): Promise<void> {
    const parsed = parseEnvelope(text);
    if (!parsed.ok) {
      this.log(`dropped message: ${parsed.error}`);
      return;
    }
    const { envelope } = parsed;

    if (envelope.type === "hello") return this.hello(socket, envelope.payload as Payload<"hello">);
    if (socket !== this.current) return; // nothing counts before hello

    switch (envelope.type) {
      case "ack":
        this.buffer.acknowledge((envelope.payload as Payload<"ack">).upTo);
        return;
      case "heartbeat":
        await recordHeartbeat(this.opts.db, this.opts.clock.now());
        for (const listener of this.heartbeatListeners) await listener(envelope.payload as Payload<"heartbeat">);
        return;
      case "welcome":
        return;
    }

    const acceptance = this.buffer.accept(envelope);
    if (acceptance === "gap") this.log(`message ids jumped to ${envelope.id}: the sender lost earlier messages`);
    if (acceptance !== "duplicate") {
      await this.persistIds();
      await this.deliver(envelope, parsed.known);
    }
    socket.send(serialize(controlMessage("ack", { upTo: this.buffer.lastReceivedId })));
  }

  private async hello(socket: LinkSocket, hello: Payload<"hello">): Promise<void> {
    if (this.current && this.current !== socket) this.current.close(CloseCode.Replaced, "replaced");
    this.current = socket;

    // A new Host Agent process numbers its messages from 1 again.
    const processChanged = hello.processId !== this.processId;
    if (processChanged) this.buffer.lastReceivedId = 0;
    this.processId = hello.processId;

    const { lastReceivedId: _ignored, liveAttempts: _live, ...facts } = hello;
    await recordHostConnected(this.opts.db, facts, this.opts.clock.now());
    await this.persistIds();

    socket.send(serialize(controlMessage("welcome", { lastReceivedId: this.buffer.lastReceivedId, podImage: this.opts.podImage })));
    for (const missed of this.buffer.unacked(hello.lastReceivedId)) socket.send(serialize(missed));
    for (const listener of this.helloListeners) await listener(hello, { processChanged });
  }

  private async deliver(envelope: Envelope, known: boolean): Promise<void> {
    if (!known || !isMessageType(envelope.type)) {
      this.log(`unknown message type ${envelope.type}, acknowledged`);
      return;
    }
    for (const handler of this.handlers.get(envelope.type) ?? []) await handler(envelope.payload as never, envelope as never);
  }

  private persistIds(): Promise<void> {
    return saveLinkIds(this.opts.db, this.buffer.state());
  }

  private log(message: string): void {
    (this.opts.log ?? console.warn)(message);
  }
}
