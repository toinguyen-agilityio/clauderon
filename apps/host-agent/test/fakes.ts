import { basename, dirname, join } from "node:path";
import type { MessageType, Payload } from "@clauderon/protocol";
import { settle } from "@clauderon/testing";
import type { AgentLink } from "../src/link";
import { EXEC_ARGS, type ExecOptions, type OutputListener, type ProcessHandle, type Signal, type System } from "../src/system";

/** One started process: a program's argv, or `bash -lc <script> …args` for a script. */
export type ExecCall = { argv: string[]; script: string; args: string[]; options: ExecOptions; pid: number };
export type ExecReply = { exitCode?: number; stdout?: string; stderr?: string; /** Holds the process until it resolves. */ until?: Promise<void> };
type Script = (call: ExecCall) => ExecReply | undefined;

/** The Machine in memory: files, scripted processes and the signals they got. */
export class FakeSystem implements System {
  files = new Map<string, string>();
  /** Paths that exist besides files, e.g. a clone's `.git`. */
  paths = new Set<string>();
  execs: ExecCall[] = [];
  kills: { pid: number; signal: Signal }[] = [];
  boot = new Date("2026-11-16T08:00:00Z");
  private nextPid = 100;
  private scripts: Script[] = [];

  /** Adds a reply for matching processes; later scripts win. */
  script(fn: Script): this {
    this.scripts.unshift(fn);
    return this;
  }

  start(script: string, args: readonly string[], options: ExecOptions, onOutput?: OutputListener): ProcessHandle {
    const pid = this.nextPid++;
    const argv = script === EXEC_ARGS ? [...args] : ["bash", "-lc", script, ...args];
    const call: ExecCall = { argv, script, args: [...args], options, pid };
    this.execs.push(call);
    let reply: ExecReply | undefined;
    for (const fn of this.scripts) {
      reply = fn(call);
      if (reply) break;
    }
    reply ??= this.builtIn(call);
    const exit = (async () => {
      await Promise.resolve();
      if (reply.stdout) onOutput?.("stdout", reply.stdout);
      if (reply.stderr) onOutput?.("stderr", reply.stderr);
      await reply.until;
      return reply.exitCode ?? 0;
    })();
    return { pid, exit, kill: (signal) => void this.kills.push({ pid, signal }) };
  }

  killGroup(pid: number, signal: Signal): void {
    this.kills.push({ pid, signal });
  }
  async writeFile(path: string, content: string) {
    this.files.set(path, content);
  }
  async readFile(path: string) {
    return this.files.get(path) ?? null;
  }
  async exists(path: string) {
    return this.files.has(path) || this.paths.has(path);
  }
  async list(dir: string) {
    return [...this.files.keys()].filter((p) => dirname(p) === dir).map((p) => basename(p));
  }
  async remove(path: string) {
    this.files.delete(path);
  }
  bootTime() {
    return this.boot;
  }

  /** The command lines of every process, joined, for assertions. */
  commands(): string[] {
    return this.execs.map((e) => e.argv.join(" "));
  }

  private builtIn(call: ExecCall): ExecReply {
    const [cmd, ...args] = call.argv;
    if (cmd === "gh" && args[0] === "repo" && args[1] === "clone") this.paths.add(join(args[3]!, ".git"));
    return {};
  }
}

type Sent = { type: MessageType; payload: unknown };

/** Plays the Agent's link: delivers Gateway messages to handlers and records what they send. */
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
    for (let i = 0; i < 5; i++) await settle();
  }

  of<T extends MessageType>(type: T): Payload<T>[] {
    return this.sent.filter((s) => s.type === type).map((s) => s.payload as Payload<T>);
  }
}

/** A promise and the function that resolves it. */
export function gate(): { promise: Promise<void>; open: () => void } {
  let open = () => {};
  const promise = new Promise<void>((resolve) => (open = resolve));
  return { promise, open };
}
