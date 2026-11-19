import { spawn } from "node:child_process";
import { userInfo } from "node:os";
import { basename, delimiter } from "node:path";

// Finding the Member's tools (ADR 0007). A service starts with a bare PATH,
// and Nodes run in `bash -lc`, which reads ~/.profile but not ~/.zshrc or
// fish's config: `claude` in ~/.local/bin or Node from nvm went missing. So
// the Agent asks the Member's own login shell, interactively, for its PATH,
// and puts that first in every Node (`CLAUDERON_PATH`).

const START = "__CLAUDERON_PATH_START__";
const END = "__CLAUDERON_PATH_END__";

/** The shell command that prints PATH between markers; interactive shells may print their own banners around it. */
export function printPathCommand(shell: string): string[] {
  const name = basename(shell);
  // fish keeps PATH as a list.
  const script = name === "fish" ? `printf '%s%s%s' ${START} (string join : $PATH) ${END}` : `printf '%s%s%s' ${START} "$PATH" ${END}`;
  return [shell, "-l", "-i", "-c", script];
}

/** The PATH between the markers, or null when the shell did not print one. */
export function parsePathOutput(output: string): string | null {
  const start = output.lastIndexOf(START);
  const end = output.lastIndexOf(END);
  if (start < 0 || end < start) return null;
  const path = output.slice(start + START.length, end).trim();
  return path ? path : null;
}

/** Joins PATH lists, earlier first, without duplicates or empty entries. */
export function mergePaths(...paths: (string | null | undefined)[]): string {
  const seen = new Set<string>();
  for (const path of paths) for (const entry of (path ?? "").split(delimiter)) if (entry) seen.add(entry);
  return [...seen].join(delimiter);
}

/** The Member's login shell: `$SHELL`, else the account's, else none (Windows). */
export function memberShell(env: NodeJS.ProcessEnv = process.env): string | null {
  if (process.platform === "win32") return null;
  if (env.SHELL) return env.SHELL;
  try {
    return userInfo().shell || null;
  } catch {
    return null;
  }
}

/** Runs the shell for its PATH; null when it fails, hangs (10 s) or prints none. */
export function shellPath(shell: string, timeoutMs = 10_000): Promise<string | null> {
  const [file, ...args] = printPathCommand(shell);
  return new Promise((resolve) => {
    let output = "";
    let done = false;
    const finish = (value: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(value);
    };
    const child = spawn(file!, args, { stdio: ["ignore", "pipe", "ignore"], detached: true });
    const timer = setTimeout(() => {
      try {
        if (child.pid) process.kill(-child.pid, "SIGKILL");
      } catch {
        // already gone
      }
      finish(null);
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString("utf8")));
    child.once("error", () => finish(null));
    child.once("close", () => finish(parsePathOutput(output)));
  });
}

/**
 * The PATH Nodes get first: the login shell's, then the Agent's own (which
 * the service sets to the installing terminal's PATH). Sets `CLAUDERON_PATH`,
 * which every Node puts first (local-system.ts), and returns it. On Windows,
 * Git Bash already builds its PATH from the Windows one: nothing to do.
 */
export async function refreshToolPath(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  const shell = memberShell(env);
  if (!shell) return null;
  const path = mergePaths(await shellPath(shell), env.PATH);
  env.CLAUDERON_PATH = path;
  return path;
}
