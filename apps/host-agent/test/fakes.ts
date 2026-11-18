import type { MessageType, Payload } from "@clauderon/protocol";
import { settle } from "@clauderon/testing";
import type { ContainerSpec, DockerClient, ExecOptions, OutputListener, TtySession } from "../src/docker";
import type { AgentLink } from "../src/pods";

export type ExecCall = { container: string; argv: string[]; options: ExecOptions };
export type ExecReply = { exitCode?: number; stdout?: string; stderr?: string };
type Script = (call: ExecCall) => ExecReply | undefined;

/** Docker in memory: containers, a set of existing paths and scripted execs. */
export class FakeDocker implements DockerClient {
  containers = new Map<string, ContainerSpec & { running: boolean }>();
  volumes = new Set<string>();
  paths = new Set<string>();
  execs: ExecCall[] = [];
  ttys: FakeTty[] = [];
  private scripts: Script[] = [];

  /** Adds a reply for matching execs; later scripts win. */
  script(fn: Script): this {
    this.scripts.unshift(fn);
    return this;
  }

  async createContainer(spec: ContainerSpec) {
    if (!this.containers.has(spec.name)) this.containers.set(spec.name, { ...spec, running: false });
    this.volumes.add(spec.volume);
    return `id-${spec.name}`;
  }
  async startContainer(name: string) {
    this.container(name).running = true;
  }
  async stopContainer(name: string) {
    this.container(name).running = false;
  }
  async removeContainer(name: string) {
    this.containers.delete(name);
  }
  async removeVolume(name: string) {
    if ([...this.containers.values()].some((c) => c.volume === name)) throw new Error(`volume ${name} is in use`);
    this.volumes.delete(name);
  }
  async listContainers(prefix: string) {
    return [...this.containers.values()].filter((c) => c.name.startsWith(prefix)).map((c) => ({ name: c.name, running: c.running }));
  }
  async imageDigest() {
    return "sha256:abc";
  }

  async exec(container: string, argv: readonly string[], options: ExecOptions, onOutput?: OutputListener) {
    const call = { container, argv: [...argv], options };
    this.execs.push(call);
    let reply: ExecReply | undefined;
    for (const script of this.scripts) {
      reply = script(call);
      if (reply) break;
    }
    reply ??= this.builtIn(call);
    if (reply.stdout) onOutput?.("stdout", reply.stdout);
    if (reply.stderr) onOutput?.("stderr", reply.stderr);
    return reply.exitCode ?? 0;
  }

  async openTty(container: string, argv: readonly string[], options: ExecOptions & { cols: number; rows: number }) {
    const tty = new FakeTty(container, [...argv], options);
    this.ttys.push(tty);
    return tty;
  }

  /** The shell commands of every exec, joined, for assertions. */
  commands(): string[] {
    return this.execs.map((e) => e.argv.join(" "));
  }

  private builtIn(call: ExecCall): ExecReply {
    const [cmd, ...args] = call.argv;
    if (cmd === "test" && args[0] === "-d") return { exitCode: this.paths.has(args[1]!) ? 0 : 1 };
    if (cmd === "gh" && args[0] === "repo" && args[1] === "clone") {
      this.paths.add(`${args[3]}/.git`);
      return {};
    }
    return {};
  }

  private container(name: string) {
    const c = this.containers.get(name);
    if (!c) throw Object.assign(new Error(`No such container: ${name}`), { statusCode: 404 });
    return c;
  }
}

export class FakeTty implements TtySession {
  written: string[] = [];
  size: [number, number];
  closed = false;
  private data: ((d: string) => void)[] = [];
  private exit: ((c: number) => void)[] = [];
  constructor(
    readonly container: string,
    readonly argv: string[],
    readonly options: ExecOptions & { cols: number; rows: number },
  ) {
    this.size = [options.cols, options.rows];
  }
  write(data: string) {
    this.written.push(data);
  }
  async resize(cols: number, rows: number) {
    this.size = [cols, rows];
  }
  close() {
    this.closed = true;
    for (const l of this.exit) l(0);
  }
  onData(l: (d: string) => void) {
    this.data.push(l);
  }
  onExit(l: (c: number) => void) {
    this.exit.push(l);
  }
  print(data: string) {
    for (const l of this.data) l(data);
  }
}

type Sent = { type: MessageType; payload: unknown };

/** Plays the Host Agent's link: delivers Gateway messages to handlers and records what they send. */
export class FakeLink implements AgentLink {
  sent: Sent[] = [];
  private handlers = new Map<string, ((p: never) => unknown)[]>();

  on<T extends MessageType>(type: T, handler: (payload: Payload<T>) => void | Promise<void>) {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler as (p: never) => unknown]);
  }
  send<T extends MessageType>(type: T, payload: Payload<T>) {
    this.sent.push({ type, payload });
  }

  async deliver<T extends MessageType>(type: T, payload: Payload<T>) {
    for (const h of this.handlers.get(type) ?? []) await h(payload as never);
    await settle();
  }

  of<T extends MessageType>(type: T): Payload<T>[] {
    return this.sent.filter((s) => s.type === type).map((s) => s.payload as Payload<T>);
  }
}
