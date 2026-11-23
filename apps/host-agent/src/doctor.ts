import { statfs } from "node:fs/promises";
import { LOW_DISK_GB } from "@clauderon/core";
import type { DoctorCheck, DoctorReport } from "@clauderon/protocol";
import type { GatewayCheck } from "./gateway-check";
import type { ClaudeLogin } from "./logins";
import { runScript, runText, type System } from "./system";

// The Agent's doctor (ADR 0007): what this Machine needs to take Runs, each
// with the one step that fixes it on this operating system. `fail` makes the
// Machine Not ready; `warn` lets it take Runs. It installs nothing itself.

export type Platform = "darwin" | "linux" | "win32" | string;

/** Below this much free disk, worktrees may not fit (shared with the web app). */
export { LOW_DISK_GB };
/** More clock skew than this breaks signed requests and confuses timestamps. */
export const CLOCK_SKEW_MS = 120_000;

/** The one step that installs or fixes something, for this operating system. */
export function fixFor(id: string, platform: Platform): string | undefined {
  const mac = platform === "darwin";
  const win = platform === "win32";
  switch (id) {
    case "tool.bash":
    case "tool.git":
      return win ? "winget install --id Git.Git -e   (Git for Windows, which also installs Git Bash)" : mac ? "xcode-select --install   (or: brew install git)" : "sudo apt install git   (or your distribution's package manager)";
    case "tool.gh":
      return win ? "winget install --id GitHub.cli -e" : mac ? "brew install gh" : "See https://github.com/cli/cli/blob/trunk/docs/install_linux.md";
    case "tool.claude":
      return win ? "irm https://claude.ai/install.ps1 | iex" : "curl -fsSL https://claude.ai/install.sh | bash";
    case "login.gh":
      return "gh auth login --web --git-protocol https";
    case "login.claude":
      return "claude auth login";
    case "git.identity":
      return 'git config --global user.name "Your Name" && git config --global user.email you@example.com';
    case "gateway.paired":
      return "Run the install command from the Machines page again: it pairs this computer anew.";
    case "gateway.reachable":
      return "Check this computer reaches the Clauderon address (open it in a browser).";
    case "gateway.clock":
      return win ? "Settings → Time & language → Sync now" : mac ? "System Settings → General → Date & Time → Set automatically" : "sudo timedatectl set-ntp true";
    case "service":
      return "Run the install command from the Machines page again: it installs the service.";
    default:
      return undefined;
  }
}

const firstLine = (text: string) => text.trim().split("\n")[0]?.trim() ?? "";

export type DoctorInput = {
  system: System;
  platform: Platform;
  /** The Agent's own directory, for the disk check. */
  home: string;
  logins: ClaudeLogin & { gh: boolean; ghAccount: string | null };
  /** Null when this computer is not paired yet. */
  gateway: GatewayCheck | null;
  /** Whether the service that runs the Agent at login is installed; null when unknown. */
  serviceInstalled: boolean | null;
  version: string;
  now?: () => Date;
  freeDiskGb?: (path: string) => Promise<number | null>;
};

async function freeDisk(path: string): Promise<number | null> {
  try {
    const s = await statfs(path);
    return Math.round(((s.bavail * s.bsize) / 1024 ** 3) * 10) / 10;
  } catch {
    return null;
  }
}

export async function runDoctor(input: DoctorInput): Promise<DoctorReport> {
  const { system, platform } = input;
  const checks: DoctorCheck[] = [];
  const add = (check: Omit<DoctorCheck, "fix"> & { fix?: string }) => {
    const fix = check.status === "ok" ? undefined : (check.fix ?? fixFor(check.id, platform));
    checks.push(fix ? { ...check, fix } : { id: check.id, title: check.title, status: check.status, ...(check.detail ? { detail: check.detail } : {}) });
  };

  // Every command runs in bash (Git Bash on Windows): without it nothing else can.
  const bash = (await system.start("true", [], {}).exit.catch(() => -1)) === 0;
  if (platform === "win32" || !bash) {
    add({ id: "tool.bash", title: platform === "win32" ? "Git Bash" : "bash", status: bash ? "ok" : "fail", detail: bash ? undefined : "bash could not start" });
  }

  const version = async (argv: string[]) => (bash ? firstLine(await runText(system, argv).catch(() => "")) : "");
  const where = async (tool: string) => (bash ? firstLine(await runScript(system, 'command -v "$1"', [tool]).catch(() => "")) : "");
  for (const [id, title, argv] of [
    ["tool.git", "git", ["git", "--version"]],
    ["tool.gh", "gh", ["gh", "--version"]],
    ["tool.claude", "Claude Code", ["claude", "--version"]],
  ] as const) {
    const found = await version([...argv]);
    const path = found ? await where(argv[0]) : "";
    add({ id, title, status: found ? "ok" : "fail", detail: found ? [found, path].filter(Boolean).join(" · ") : `${argv[0]} not found on the PATH` });
  }

  add({
    id: "login.claude",
    title: "Claude Code login",
    status: input.logins.claude ? "ok" : "fail",
    detail: input.logins.claude ? [input.logins.claudeAccount, input.logins.claudePlan].filter(Boolean).join(" · ") || undefined : "not logged in",
  });
  add({ id: "login.gh", title: "gh login", status: input.logins.gh ? "ok" : "fail", detail: input.logins.gh ? (input.logins.ghAccount ?? undefined) : "not logged in" });

  const name = bash ? firstLine(await runText(system, ["git", "config", "--global", "user.name"]).catch(() => "")) : "";
  const email = bash ? firstLine(await runText(system, ["git", "config", "--global", "user.email"]).catch(() => "")) : "";
  add({ id: "git.identity", title: "git name and email", status: name && email ? "ok" : "warn", detail: name && email ? `${name} <${email}>` : "commits need user.name and user.email" });

  const gw = input.gateway;
  if (!gw) add({ id: "gateway.paired", title: "Pairing", status: "fail", detail: "this computer is not paired yet" });
  else if (gw.state === "unreachable") add({ id: "gateway.reachable", title: "Gateway", status: "fail", detail: gw.error });
  else if (gw.state === "unpaired") add({ id: "gateway.paired", title: "Pairing", status: "fail", detail: "the Gateway no longer accepts this computer" });
  else {
    add({ id: "gateway.paired", title: "Pairing", status: "ok" });
    if (gw.skewMs !== null) {
      const off = Math.abs(gw.skewMs);
      add({ id: "gateway.clock", title: "Clock", status: off > CLOCK_SKEW_MS ? "warn" : "ok", detail: off > CLOCK_SKEW_MS ? `${Math.round(off / 1000)} s off the Gateway's clock` : undefined });
    }
  }

  if (input.serviceInstalled !== null) {
    add({ id: "service", title: "Runs at login", status: input.serviceInstalled ? "ok" : "warn", detail: input.serviceInstalled ? undefined : "the Agent stops when this terminal closes" });
  }

  const free = await (input.freeDiskGb ?? freeDisk)(input.home);
  if (free !== null) add({ id: "disk", title: "Free disk", status: free < LOW_DISK_GB ? "warn" : "ok", detail: `${free} GB free`, fix: `Free up space: each Run's worktree lives under ${input.home}.` });

  add({ id: "agent.version", title: "Agent", status: "ok", detail: input.version });
  return { checkedAt: (input.now?.() ?? new Date()).toISOString(), checks };
}

