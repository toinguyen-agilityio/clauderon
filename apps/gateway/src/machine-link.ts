import type { Clock } from "@clauderon/core";
import {
  hashToken,
  listMachines,
  machineOfTokenHash,
  markAllMachinesDisconnected,
  recordMachineConnected,
  recordMachineDisconnected,
  recordMachineHeartbeat,
  saveMachineLinkIds,
  type Db,
} from "@clauderon/db";
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

type Handler<T extends MessageType> = (payload: Payload<T>, machineId: string) => void | Promise<void>;
/** A `hello`: whether the Agent process changed since the one the Gateway last knew. */
export type HelloListener = (machineId: string, hello: Payload<"hello">, info: { processChanged: boolean }) => void | Promise<void>;
export type HeartbeatListener = (machineId: string) => void | Promise<void>;

export type MachineLinksOptions = { db: Db; clock: Clock; log?: (message: string) => void };

/** One Machine's end of the link: its resume buffer, socket and Agent process. */
type Link = { buffer: ResumeBuffer; socket: LinkSocket | null; processId: string | null };

/**
 * The Gateway's end of every Agent WebSocket (spec M0 §4, ADR 0006). An
 * Agent proves its Machine with its token; each Machine has its own resume
 * buffer, so numbered messages resend per Machine after a drop. Messages are
 * handled one at a time, in arrival order, across all Machines.
 */
export class MachineLinks {
  private links = new Map<string, Link>();
  private handlers = new Map<string, Handler<MessageType>[]>();
  private queue: Promise<void> = Promise.resolve();
  private helloListeners: HelloListener[] = [];
  private heartbeatListeners: HeartbeatListener[] = [];

  constructor(private readonly opts: MachineLinksOptions) {}

  /** Loads each Machine's message ids; call once before accepting sockets. */
  async start(): Promise<void> {
    for (const machine of await listMachines(this.opts.db)) {
      this.links.set(machine.id, {
        buffer: new ResumeBuffer({ lastSentId: machine.lastSentId, lastReceivedId: machine.lastReceivedId }),
        socket: null,
        processId: machine.processId,
      });
    }
    // No socket survives a Gateway restart: show disconnected until hello.
    await markAllMachinesDisconnected(this.opts.db);
  }

  onHello(listener: HelloListener): void {
    this.helloListeners.push(listener);
  }

  onHeartbeat(listener: HeartbeatListener): void {
    this.heartbeatListeners.push(listener);
  }

  on<T extends MessageType>(type: T, handler: Handler<T>): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler as Handler<MessageType>);
    this.handlers.set(type, list);
  }

  connected(machineId: string): boolean {
    return Boolean(this.links.get(machineId)?.socket);
  }

  /** Accepts an Agent socket whose `Bearer` token is a paired Machine's. */
  attach(socket: LinkSocket, authorization: string | undefined): void {
    const token = /^Bearer (.+)$/.exec(authorization ?? "")?.[1];
    // Messages can arrive before the token is checked: hold them.
    const early: string[] = [];
    let machineId: string | null = null;
    socket.onMessage((text) => (machineId ? this.enqueue(() => this.handle(machineId!, socket, text)) : early.push(text)));
    socket.onClose(() =>
      this.enqueue(async () => {
        if (!machineId) return;
        const link = this.links.get(machineId);
        if (link?.socket !== socket) return;
        link.socket = null;
        await recordMachineDisconnected(this.opts.db, machineId);
      }),
    );
    this.enqueue(async () => {
      const machine = token ? await machineOfTokenHash(this.opts.db, hashToken(token)) : null;
      if (!machine) {
        socket.close(CloseCode.Unauthorized, "unauthorized");
        return;
      }
      machineId = machine.id;
      for (const text of early.splice(0)) await this.handle(machine.id, socket, text);
    });
  }

  /** Sends a numbered message now, or on the Machine's next connection if none is open. */
  send<T extends MessageType>(machineId: string, type: T, payload: Payload<T>, re?: number): Envelope {
    const link = this.link(machineId);
    const envelope = link.buffer.next(type, payload, re);
    link.socket?.send(serialize(envelope));
    this.enqueue(() => this.persistIds(machineId));
    return envelope;
  }

  /** Closes a silent Machine's socket; its Agent reconnects with a hello. */
  drop(machineId: string, reason: string): void {
    const link = this.links.get(machineId);
    const socket = link?.socket;
    if (!link || !socket) return;
    link.socket = null;
    socket.close(CloseCode.Silent, reason);
    this.enqueue(() => recordMachineDisconnected(this.opts.db, machineId));
  }

  /**
   * The Machine was paired anew or unpaired (ADR 0006): the old token no
   * longer works, so its socket closes, and the next Agent starts numbering
   * from scratch, as the database already does.
   */
  repaired(machineId: string): Promise<void> {
    return this.enqueue(async () => {
      const old = this.links.get(machineId)?.socket;
      this.links.set(machineId, { buffer: new ResumeBuffer(), socket: null, processId: null });
      old?.close(CloseCode.Revoked, "replaced by a new pairing");
      await recordMachineDisconnected(this.opts.db, machineId);
    });
  }

  /** Resolves once every message received so far has been handled. */
  idle(): Promise<void> {
    return this.queue;
  }

  private link(machineId: string): Link {
    let link = this.links.get(machineId);
    if (!link) {
      // A Machine paired since this Gateway started: its ids start at 0.
      link = { buffer: new ResumeBuffer(), socket: null, processId: null };
      this.links.set(machineId, link);
    }
    return link;
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    this.queue = this.queue.then(task).catch((error: unknown) => this.log(`machine link error: ${String(error)}`));
    return this.queue;
  }

  private async handle(machineId: string, socket: LinkSocket, text: string): Promise<void> {
    const parsed = parseEnvelope(text);
    if (!parsed.ok) {
      this.log(`dropped message: ${parsed.error}`);
      return;
    }
    const { envelope } = parsed;
    const link = this.link(machineId);

    if (envelope.type === "hello") return this.hello(machineId, link, socket, envelope.payload as Payload<"hello">);
    if (socket !== link.socket) return; // nothing counts before hello

    switch (envelope.type) {
      case "ack":
        link.buffer.acknowledge((envelope.payload as Payload<"ack">).upTo);
        return;
      case "heartbeat":
        await recordMachineHeartbeat(this.opts.db, machineId, this.opts.clock.now(), (envelope.payload as Payload<"heartbeat">).usage);
        for (const listener of this.heartbeatListeners) await listener(machineId);
        return;
      case "welcome":
        return;
    }

    const acceptance = link.buffer.accept(envelope);
    if (acceptance === "gap") this.log(`machine ${machineId}: message ids jumped to ${envelope.id}: the sender lost earlier messages`);
    if (acceptance !== "duplicate") {
      await this.persistIds(machineId);
      await this.deliver(machineId, envelope, parsed.known);
    }
    socket.send(serialize(controlMessage("ack", { upTo: link.buffer.lastReceivedId })));
  }

  private async hello(machineId: string, link: Link, socket: LinkSocket, hello: Payload<"hello">): Promise<void> {
    if (link.socket && link.socket !== socket) link.socket.close(CloseCode.Replaced, "replaced");
    link.socket = socket;

    // A new Agent process numbers its messages from 1 again.
    const processChanged = hello.processId !== link.processId;
    if (processChanged) link.buffer.lastReceivedId = 0;
    link.processId = hello.processId;

    const { lastReceivedId: _ignored, liveAttempts: _live, ...facts } = hello;
    await recordMachineConnected(this.opts.db, machineId, facts, this.opts.clock.now());
    await this.persistIds(machineId);

    socket.send(serialize(controlMessage("welcome", { lastReceivedId: link.buffer.lastReceivedId })));
    for (const missed of link.buffer.unacked(hello.lastReceivedId)) socket.send(serialize(missed));
    for (const listener of this.helloListeners) await listener(machineId, hello, { processChanged });
  }

  private async deliver(machineId: string, envelope: Envelope, known: boolean): Promise<void> {
    if (!known || !isMessageType(envelope.type)) {
      this.log(`unknown message type ${envelope.type}, acknowledged`);
      return;
    }
    for (const handler of this.handlers.get(envelope.type) ?? []) await handler(envelope.payload as never, machineId);
  }

  private persistIds(machineId: string): Promise<void> {
    const link = this.links.get(machineId);
    return link ? saveMachineLinkIds(this.opts.db, machineId, link.buffer.state()) : Promise.resolve();
  }

  private log(message: string): void {
    (this.opts.log ?? console.warn)(message);
  }
}
