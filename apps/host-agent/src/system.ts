// What the Agent needs from its Machine's operating system: processes and a
// few files. Tests run the real Agent against a fake (spec "test seam").

export type ExecOptions = {
  cwd?: string;
  /** Added to the Agent's own environment. */
  env?: Record<string, string>;
};

export type OutputListener = (stream: "stdout" | "stderr", text: string) => void;

export type Signal = "TERM" | "KILL";

/** A started process and everything it starts, killed as one group. */
export interface ProcessHandle {
  readonly pid: number | undefined;
  /** Resolves with the exit code; -1 when it could not start or died from a signal. */
  readonly exit: Promise<number>;
  kill(signal: Signal): void;
}

export interface System {
  /**
   * Runs a bash script in a login shell (`bash -lc`, Git Bash on Windows), so
   * the Member's PATH and tools apply; `args` become `$1`, `$2`…. The process
   * leads its own group, so killing it kills its children too.
   */
  start(script: string, args: readonly string[], options: ExecOptions, onOutput?: OutputListener): ProcessHandle;
  /** Signals a process group started by an earlier Agent process (orphans, RUN-12). */
  killGroup(pid: number, signal: Signal): void;
  writeFile(path: string, content: string): Promise<void>;
  readFile(path: string): Promise<string | null>;
  /** Writes bytes as they are, making the folders it needs, e.g. a Run's attached files. */
  writeBytes(path: string, data: Uint8Array): Promise<void>;
  /** The file's bytes, or null when it does not exist. */
  readBytes(path: string): Promise<Uint8Array | null>;
  exists(path: string): Promise<boolean>;
  /** File names in a directory; none when it does not exist. */
  list(dir: string): Promise<string[]>;
  remove(path: string): Promise<void>;
  /** When the operating system booted, to tell a pid of this boot from one of an earlier boot. */
  bootTime(): Date;
}

/** Runs one program with its arguments, never through word splitting. */
export const EXEC_ARGS = 'exec "$@"';

/** Runs a program and resolves with its exit code. */
export function run(system: System, argv: readonly string[], options: ExecOptions = {}, onOutput?: OutputListener): Promise<number> {
  return system.start(EXEC_ARGS, argv, options, onOutput).exit;
}

/** Runs a bash script and collects its stdout; throws with stderr on a non-zero exit. */
export async function runScript(system: System, script: string, args: readonly string[], options: ExecOptions = {}): Promise<string> {
  let stdout = "";
  let stderr = "";
  const code = await system.start(script, args, options, (stream, text) => {
    if (stream === "stdout") stdout += text;
    else stderr += text;
  }).exit;
  if (code !== 0) throw new Error(`${script === EXEC_ARGS ? args.join(" ") : "script"} exited ${code}: ${stderr.trim()}`);
  return stdout;
}

/** Runs a program and collects its stdout; throws with stderr on a non-zero exit. */
export function runText(system: System, argv: readonly string[], options: ExecOptions = {}): Promise<string> {
  return runScript(system, EXEC_ARGS, argv, options);
}
