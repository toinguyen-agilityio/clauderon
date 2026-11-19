import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { uptime } from "node:os";
import { dirname, join } from "node:path";
import { StringDecoder } from "node:string_decoder";
import type { ProcessHandle, Signal, System } from "./system";

const WINDOWS = process.platform === "win32";

/**
 * The bash every command runs in (ADR 0006): `CLAUDERON_BASH`, else Git
 * Bash where Git for Windows installs it, else `bash` on the PATH.
 */
export function findBash(env: NodeJS.ProcessEnv = process.env): string {
  if (env.CLAUDERON_BASH) return env.CLAUDERON_BASH;
  if (!WINDOWS) return "bash";
  const roots = [env.ProgramFiles, env["ProgramFiles(x86)"], env.LOCALAPPDATA && join(env.LOCALAPPDATA, "Programs")];
  for (const root of roots) {
    const candidate = root ? join(root, "Git", "bin", "bash.exe") : null;
    if (candidate && existsSync(candidate)) return candidate;
  }
  return "bash.exe";
}

// A login profile may reset PATH (Debian's does), so the Agent's own tools
// are put first inside the shell. Git Bash wants a POSIX path.
const WITH_AGENT_BIN = 'if [ -n "${CLAUDERON_BIN:-}" ]; then PATH="$(cygpath -u "$CLAUDERON_BIN" 2>/dev/null || printf %s "$CLAUDERON_BIN"):$PATH"; export PATH; fi\n';

function signalGroup(pid: number, signal: Signal): void {
  if (WINDOWS) {
    // No process groups or SIGTERM: end the whole tree at once.
    spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true }).on("error", () => {});
    return;
  }
  try {
    process.kill(-pid, `SIG${signal}`);
  } catch {
    // already gone
  }
}

/** Processes and files on this Machine; `binDir` holds the Agent's own tools (`clauderon-open-pr`). */
export function localSystem({ binDir, bash = findBash() }: { binDir: string; bash?: string }): System {
  return {
    start(script, args, options, onOutput): ProcessHandle {
      const child = spawn(bash, ["-lc", WITH_AGENT_BIN + script, "clauderon", ...args], {
        cwd: options.cwd,
        env: { ...process.env, ...options.env, CLAUDERON_BIN: binDir },
        // Its own process group, so a kill reaches everything it started.
        detached: !WINDOWS,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      const out = new StringDecoder("utf8");
      const err = new StringDecoder("utf8");
      child.stdout.on("data", (chunk: Buffer) => onOutput?.("stdout", out.write(chunk)));
      child.stderr.on("data", (chunk: Buffer) => onOutput?.("stderr", err.write(chunk)));
      const exit = new Promise<number>((resolve) => {
        child.once("error", (error) => {
          onOutput?.("stderr", `${error.message}\n`);
          resolve(-1);
        });
        child.once("close", (code) => resolve(code ?? -1));
      });
      return {
        pid: child.pid,
        exit,
        kill: (signal) => {
          if (child.pid !== undefined && child.exitCode === null) signalGroup(child.pid, signal);
        },
      };
    },

    killGroup: signalGroup,

    async writeFile(path, content) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content);
    },

    async readFile(path) {
      try {
        return await readFile(path, "utf8");
      } catch {
        return null;
      }
    },

    async exists(path) {
      return stat(path).then(
        () => true,
        () => false,
      );
    },

    async list(dir) {
      return readdir(dir).catch(() => []);
    },

    async remove(path) {
      await rm(path, { force: true, recursive: true });
    },

    bootTime: () => new Date(Date.now() - uptime() * 1000),
  };
}
