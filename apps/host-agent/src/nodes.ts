import { join } from "node:path";
import { mask, tailLines } from "@clauderon/core";
import type { Payload } from "@clauderon/protocol";
import { ClaudeErrorWatch, TurnRecorder, claudeCommand, claudeResult, parseClaudeLine } from "./claude";
import { errorText, type AgentLink, type Log } from "./link";
import { runText, type ProcessHandle, type System } from "./system";

/** Inputs passed as files: the Gateway sends the text, the Node gets `<NAME>_FILE`. */
export const FILE_ENV = ["CLAUDERON_SUMMARY", "CLAUDERON_TEST_RESULT", "CLAUDERON_RETRY_CONTEXT"] as const;
/** Set by the Gateway when the Node must produce a `branch`: HEAD has to move. */
export const EXPECT_COMMIT_ENV = "CLAUDERON_EXPECT_COMMIT";
export const TAIL_LINES = 200;
/** Set on every Node process, and inherited by its children. */
export const ATTEMPT_ENV = "CLAUDERON_ATTEMPT_ID";
/** Between SIGTERM and SIGKILL when a Node is killed. */
export const KILL_GRACE_MS = 10_000;
/** A pid file whose boot time differs by more than this is from an earlier boot: its pid means nothing now. */
const SAME_BOOT_MS = 120_000;

/** Terminal colour and cursor codes (CSI sequences). */
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

/** What Claude Code prints when `--resume` names a session it does not know. */
export const UNKNOWN_SESSION = /no conversation found|session[^\n]*(not found|does not exist|unknown)|invalid session/i;

/** Splits streamed text into lines, holding a partial line until it ends. */
export class Lines {
  private rest = "";
  constructor(private readonly emit: (line: string) => void) {}
  push(text: string): void {
    const parts = (this.rest + text).split("\n");
    this.rest = parts.pop() ?? "";
    for (const line of parts) this.emit(line.replace(/\r$/, ""));
  }
  flush(): void {
    if (this.rest) this.emit(this.rest);
    this.rest = "";
  }
}

export type NodeRunnerOptions = {
  log: Log;
  knownSecrets: readonly string[];
  /** The Agent's directory: pid files of running Nodes live in `<home>/nodes`. */
  home: string;
  killGraceMs?: number;
};

/** The Agent's handle on its Nodes: what runs, and the orphan sweep (spec M3 §6). */
export type NodeHandles = {
  running(): string[];
  killOrphans(): Promise<void>;
};

/** One Node in flight: its process once started, and whether a kill came first. */
type Running = { process: ProcessHandle | null; killed: boolean };

type PidFile = { pid: number; bootAt: string };

const pidFile = (home: string, attemptId: string) => join(home, "nodes", `${attemptId}.json`);

/** SIGTERM now, SIGKILL after the grace period, to a whole process group. */
export function terminate(kill: (signal: "TERM" | "KILL") => void, graceMs: number): void {
  kill("TERM");
  setTimeout(() => kill("KILL"), graceMs).unref?.();
}

/**
 * `node.run` (spec M1 §4.3, §4.4): runs a Command or Agent Node in the Run's
 * worktree under the Member's own logins, streams masked log lines, and
 * reports one `node.result`. Runs in the background so other Runs go on.
 */
export function registerNodeHandlers(link: AgentLink, system: System, options: NodeRunnerOptions): NodeHandles {
  const graceMs = options.killGraceMs ?? KILL_GRACE_MS;
  const running = new Map<string, Running>();
  // Log line numbers go on across a Grill Attempt's rounds, so none repeats.
  const seqs = new Map<string, { next: number }>();
  let sweep: Promise<void> = Promise.resolve();

  link.on("node.run", (payload) => {
    const entry: Running = { process: null, killed: false };
    running.set(payload.attemptId, entry);
    const seq = seqs.get(payload.attemptId) ?? { next: 0 };
    seqs.set(payload.attemptId, seq);
    const started = async (proc: ProcessHandle) => {
      entry.process = proc;
      if (entry.killed) terminate((signal) => proc.kill(signal), graceMs);
      // Recorded so a later Agent process can kill it if this one dies first.
      if (proc.pid !== undefined) {
        const record: PidFile = { pid: proc.pid, bootAt: system.bootTime().toISOString() };
        await system.writeFile(pidFile(options.home, payload.attemptId), JSON.stringify(record)).catch(() => {});
      }
    };
    // After an orphan sweep, so the sweep never mistakes this Node for an orphan.
    void sweep
      .then(() => runNode(link, system, options, payload, seq, started))
      .finally(async () => {
        running.delete(payload.attemptId);
        await system.remove(pidFile(options.home, payload.attemptId)).catch(() => {});
      });
  });

  // A cancelled Run (RUN-8): the Gateway already ended the Attempt, so its
  // late `node.result` is ignored; an unknown Attempt has nothing to kill.
  link.on("node.kill", ({ attemptId }) => {
    const entry = running.get(attemptId);
    if (!entry || entry.killed) return;
    entry.killed = true;
    if (entry.process) { const proc = entry.process; terminate((signal) => proc.kill(signal), graceMs); }
  });

  return {
    running: () => [...running.keys()],
    /** Kills Node process groups that an earlier Agent process left behind (RUN-12). */
    killOrphans() {
      sweep = sweep
        .then(async () => {
          const dir = join(options.home, "nodes");
          const boot = system.bootTime().getTime();
          for (const name of await system.list(dir)) {
            const attemptId = name.replace(/\.json$/, "");
            if (running.has(attemptId)) continue;
            const path = join(dir, name);
            try {
              const record = JSON.parse((await system.readFile(path)) ?? "null") as PidFile | null;
              if (record && Number.isInteger(record.pid) && Math.abs(new Date(record.bootAt).getTime() - boot) < SAME_BOOT_MS) {
                options.log(`killing orphaned Node ${attemptId} (process group ${record.pid})`);
                terminate((signal) => system.killGroup(record.pid, signal), graceMs);
              }
            } catch (error) {
              options.log(`orphan ${attemptId}: ${errorText(error)}`);
            }
            await system.remove(path).catch(() => {});
          }
        })
        .catch((error: unknown) => options.log(`orphan sweep: ${String(error)}`));
      return sweep;
    },
  };
}

export async function runNode(
  link: AgentLink,
  system: System,
  options: Pick<NodeRunnerOptions, "log" | "knownSecrets">,
  run: Payload<"node.run">,
  counter: { next: number } = { next: 0 },
  started: (process: ProcessHandle) => void | Promise<void> = () => {},
): Promise<void> {
  const inWorktree = { cwd: run.worktreePath };
  /** Starts the Node's own process: the one `node.kill` stops. */
  const start = async (script: string, env: Record<string, string>, onOutput: Parameters<System["start"]>[3]) => {
    const proc = system.start(script, [], { ...inWorktree, env }, onOutput);
    await started(proc);
    return proc.exit;
  };
  const secrets = [...options.knownSecrets];
  const hide = (text: string) => mask(text, secrets);
  const log = (stream: "stdout" | "stderr" | "system", text: string) =>
    link.send("node.log", { attemptId: run.attemptId, seq: counter.next++, stream, text: hide(text) });

  try {
    // The owner's own gh token is a secret too (NFR-1).
    const token = (await runText(system, ["gh", "auth", "token"]).catch(() => "")).trim();
    if (token) secrets.push(token);

    const git = async (...args: string[]) => (await runText(system, ["git", ...args], inWorktree)).trim();
    const gitDir = await git("rev-parse", "--absolute-git-dir");
    const headBefore = await git("rev-parse", "HEAD");
    const writeFile = (path: string, content: string) => system.writeFile(path, content);

    const env: Record<string, string> = { ...run.env, [ATTEMPT_ENV]: run.attemptId };
    const expectCommit = env[EXPECT_COMMIT_ENV] === "1";
    delete env[EXPECT_COMMIT_ENV];
    for (const key of FILE_ENV) {
      const content = env[key];
      if (content === undefined) continue;
      delete env[key];
      // Inside the worktree's git directory, so it is never committed.
      const path = `${gitDir}/clauderon-${run.attemptId}-${key.toLowerCase()}`;
      await writeFile(path, content);
      env[`${key}_FILE`] = path;
    }

    let exitCode: number;
    let result: unknown;
    let sessionId: string | undefined;
    let error: string | undefined;

    if (run.kind === "command") {
      const output: string[] = [];
      let pullRequest: unknown;
      // Test runners and servers colour their output; the codes would end up
      // in the log view and the pull request's test result as raw text.
      const plain = (emit: (line: string) => void) => (line: string) => emit(line.replace(ANSI, ""));
      const streams = {
        stdout: new Lines(plain((line) => {
          output.push(line);
          if (line.startsWith('{"pullRequest"')) {
            try {
              pullRequest = (JSON.parse(line) as { pullRequest: unknown }).pullRequest;
            } catch {
              // not the script's result line
            }
          }
          log("stdout", line);
        })),
        stderr: new Lines(plain((line) => {
          output.push(line);
          log("stderr", line);
        })),
      };
      exitCode = await start(run.command ?? "true", env, (stream, text) => streams[stream].push(text));
      streams.stdout.flush();
      streams.stderr.flush();
      result = { tail: hide(tailLines(output.join("\n"), TAIL_LINES)), ...(pullRequest ? { pullRequest } : {}) };
      if (exitCode !== 0) error = `Command exited ${exitCode}`;
    } else {
      const promptFile = `${gitDir}/clauderon-prompt-${run.attemptId}.md`;
      await writeFile(promptFile, run.prompt ?? "");
      let finalText: string | undefined;
      let unknownSession: string | undefined;
      const errors = new ClaudeErrorWatch();
      const recorder = new TurnRecorder(hide, run.worktreePath);
      const watch = (line: string) => {
        if (run.resumeSessionId && !unknownSession && UNKNOWN_SESSION.test(line)) unknownSession = line.trim();
      };
      const stdout = new Lines((line) => {
        // A stream-json event carries the session id and Claude's own text, which
        // can read like the unknown-session message; only plain lines count.
        if (!line.trimStart().startsWith("{")) watch(line);
        const event = parseClaudeLine(line);
        errors.event(event);
        recorder.event(event);
        if (event.sessionId) sessionId = event.sessionId;
        if (event.usage) link.send("node.usage", { attemptId: run.attemptId, ...event.usage });
        if (event.finalText !== undefined) finalText = event.finalText;
        if (event.log) for (const part of event.log.split("\n")) log("stdout", part);
      });
      const stderr = new Lines((line) => {
        watch(line);
        errors.stderr(line);
        log("stderr", line);
      });
      exitCode = await start(claudeCommand(run.resumeSessionId), { ...env, CLAUDERON_PROMPT_FILE: promptFile }, (stream, text) =>
        (stream === "stdout" ? stdout : stderr).push(text),
      );
      stdout.flush();
      stderr.flush();
      const turns = recorder.turns();
      if (turns.length > 0) link.send("node.turns", { attemptId: run.attemptId, turns });
      result = claudeResult(finalText);
      if (exitCode !== 0) error = hide(errors.reason(exitCode));
      // A Grill round whose session Claude no longer knows (spec M3 §2.2).
      if (unknownSession && result === undefined) error = `Claude session ${run.resumeSessionId} could not be resumed: ${hide(unknownSession)}`;
    }

    const headCommit = await git("rev-parse", "HEAD");
    if (!error && expectCommit && headCommit === headBefore) error = "no commit on the branch";
    link.send("node.result", { attemptId: run.attemptId, exitCode, result, sessionId, headCommit, ...(error ? { error } : {}) });
  } catch (failure) {
    const text = hide(errorText(failure));
    options.log(`node ${run.attemptId}: ${text}`);
    log("system", text);
    link.send("node.result", { attemptId: run.attemptId, exitCode: -1, error: text });
  }
}
