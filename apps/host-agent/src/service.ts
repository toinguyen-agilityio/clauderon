import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";

// Runs the Agent whenever the Member is logged in (ADR 0006), under their own
// user, so Runs use their own Claude Code and gh logins: a launchd user agent
// on macOS, a systemd user unit on Linux, a per-user Run key on Windows (a
// logon Scheduled Task needs administrator rights, which the Member lacks).
// Never root or a system service.

export const SERVICE_LABEL = "com.clauderon.agent";
const WINDOWS_RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";

/**
 * The service's names for one Agent home. The default home (~/.clauderon)
 * keeps the original names; any other home (e.g. ~/.clauderon-dev, which the
 * install script of a local web app picks) gets its own, so the Agent of a
 * second web app on the same computer does not replace the first one's service.
 */
export function serviceNames(home: string): { label: string; unit: string; runName: string } {
  const suffix = basename(home)
    .replace(/^\.?clauderon-?/, "")
    .replace(/^\./, "")
    .replace(/[^A-Za-z0-9-]/g, "-");
  if (!suffix) return { label: SERVICE_LABEL, unit: "clauderon-agent.service", runName: "Clauderon Agent" };
  return { label: `${SERVICE_LABEL}.${suffix}`, unit: `clauderon-agent-${suffix}.service`, runName: `Clauderon Agent (${suffix})` };
}

/** How the service starts the Agent: this Node with these arguments, from this directory, with this home. */
export type ServiceSpec = {
  /** Absolute path of the Node binary: the Agent's own, under `<home>/node` (ADR 0007). */
  node: string;
  /** Node's arguments: `<home>/agent/agent.mjs run` for the bundle, `--import tsx …/main.ts run` from a checkout. */
  args: string[];
  /** The working directory. */
  cwd: string;
  home: string;
  /**
   * The PATH of the shell that installs the service. A service starts with a
   * bare system PATH; the Agent also asks the login shell (tool-path.ts), and
   * this is the fallback when that fails.
   */
  path?: string;
};

/** The service's command line. */
export const serviceArgs = (spec: ServiceSpec) => [spec.node, ...spec.args];

export const logFile = (spec: Pick<ServiceSpec, "home">) => join(spec.home, "agent.log");

const xml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The launchd user agent. It restarts the Agent after a crash, not after a
 * clean stop: an unpaired Agent exits 0 and stays stopped until paired again.
 */
export function launchdPlist(spec: ServiceSpec): string {
  const args = serviceArgs(spec)
    .map((a) => `    <string>${xml(a)}</string>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${serviceNames(spec.home).label}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>WorkingDirectory</key>
  <string>${xml(spec.cwd)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>CLAUDERON_HOME</key>
    <string>${xml(spec.home)}</string>
    <key>CLAUDERON_SERVICE</key>
    <string>1</string>${spec.path ? `\n    <key>PATH</key>\n    <string>${xml(spec.path)}</string>` : ""}
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>${xml(logFile(spec))}</string>
  <key>StandardErrorPath</key>
  <string>${xml(logFile(spec))}</string>
</dict>
</plist>
`;
}

const systemdQuote = (arg: string) => (/^[A-Za-z0-9_./:@=+-]+$/.test(arg) ? arg : `"${arg.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);

/** The systemd user unit; `Restart=on-failure` for the same reason as launchd's `SuccessfulExit`. */
export function systemdUnit(spec: ServiceSpec): string {
  return `[Unit]
Description=Clauderon Agent
After=network-online.target

[Service]
WorkingDirectory=${systemdQuote(spec.cwd)}
Environment=CLAUDERON_HOME=${systemdQuote(spec.home)}
Environment=CLAUDERON_SERVICE=1
${spec.path ? `Environment=PATH=${systemdQuote(spec.path)}\n` : ""}ExecStart=${serviceArgs(spec).map(systemdQuote).join(" ")}
Restart=on-failure
RestartSec=10
StandardOutput=append:${logFile(spec)}
StandardError=append:${logFile(spec)}

[Install]
WantedBy=default.target
`;
}

/** The launcher script the Run key starts, so the key's value stays short and quoting stays in one place. */
export const windowsLauncherPath = (spec: Pick<ServiceSpec, "home">) => join(spec.home, "agent-service.cmd");

/** A tiny script that runs the launcher with no window at all: a visible console would stop the Agent when closed. */
export const windowsHiddenPath = (spec: Pick<ServiceSpec, "home">) => join(spec.home, "agent-service.vbs");

export const windowsHidden = (spec: Pick<ServiceSpec, "home">) =>
  `CreateObject("WScript.Shell").Run """${windowsLauncherPath(spec)}""", 0, False\r\n`;

/**
 * The Run key's value: starts the launcher (below) hidden. The launcher sets
 * the home, then runs the Agent, logging to a file. Nothing restarts a stopped
 * Agent, so an updated Agent starts its successor itself (main.ts).
 */
export const windowsRunCommand = (spec: Pick<ServiceSpec, "home">) => `wscript.exe //B //Nologo "${windowsHiddenPath(spec)}"`;

export function windowsLauncher(spec: ServiceSpec): string {
  const quote = (a: string) => `"${a}"`;
  const run = serviceArgs(spec).map(quote).join(" ");
  return [
    "@echo off",
    `set "CLAUDERON_HOME=${spec.home}"`,
    "set CLAUDERON_SERVICE=1",
    `cd /d ${quote(spec.cwd)}`,
    `${run} >> ${quote(logFile(spec))} 2>&1`,
    "",
  ].join("\r\n");
}

export const launchdPath = (home: string) => join(homedir(), "Library", "LaunchAgents", `${serviceNames(home).label}.plist`);
export const systemdPath = (home: string) => join(homedir(), ".config", "systemd", "user", serviceNames(home).unit);

type Exec = (file: string, args: readonly string[]) => Promise<void>;
const exec: Exec = async (file, args) => {
  await promisify(execFile)(file, [...args]);
};

/** Starts the hidden launcher now, detached. */
const launchDetached = (file: string) => {
  spawn("wscript.exe", ["//B", "//Nologo", file], { detached: true, stdio: "ignore", windowsHide: true }).unref();
};

async function write(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Installs, or replaces, the service and starts it now. Returns where its log goes. */
export async function installService(spec: ServiceSpec, platform: NodeJS.Platform = process.platform, run: Exec = exec, launch = launchDetached, pause = sleep): Promise<string> {
  await mkdir(spec.home, { recursive: true });
  const names = serviceNames(spec.home);
  if (platform === "darwin") {
    const path = launchdPath(spec.home);
    const domain = `gui/${process.getuid?.() ?? 0}`;
    await run("launchctl", ["bootout", `${domain}/${names.label}`]).catch(() => {});
    await write(path, launchdPlist(spec));
    // bootout returns before the replaced Agent has exited, and until it has,
    // bootstrap fails with "5: Input/output error"; so retry for a few seconds.
    for (let attempt = 1; ; attempt++) {
      try {
        await run("launchctl", ["bootstrap", domain, path]);
        break;
      } catch (error) {
        if (attempt >= 10) throw error;
        await pause(500);
      }
    }
  } else if (platform === "linux") {
    await write(systemdPath(spec.home), systemdUnit(spec));
    await run("systemctl", ["--user", "daemon-reload"]);
    await run("systemctl", ["--user", "enable", "--now", names.unit]);
    await run("systemctl", ["--user", "restart", names.unit]);
  } else if (platform === "win32") {
    await write(windowsLauncherPath(spec), windowsLauncher(spec));
    await write(windowsHiddenPath(spec), windowsHidden(spec));
    await run("reg", ["add", WINDOWS_RUN_KEY, "/v", names.runName, "/t", "REG_SZ", "/d", windowsRunCommand(spec), "/f"]);
    launch(windowsHiddenPath(spec));
  } else {
    throw new Error(`no service support for ${platform}: run the Agent with start instead`);
  }
  return logFile(spec);
}

/** Whether the service is installed; null on a platform without one. */
export async function serviceInstalled(home: string, platform: NodeJS.Platform = process.platform, run: Exec = exec): Promise<boolean | null> {
  if (platform === "darwin") return existsSync(launchdPath(home));
  if (platform === "linux") return existsSync(systemdPath(home));
  if (platform === "win32") return run("reg", ["query", WINDOWS_RUN_KEY, "/v", serviceNames(home).runName]).then(
    () => true,
    () => false,
  );
  return null;
}

/** Stops and removes the service; a missing one is fine. */
export async function uninstallService(home: string, platform: NodeJS.Platform = process.platform, run: Exec = exec): Promise<void> {
  const names = serviceNames(home);
  if (platform === "darwin") {
    await run("launchctl", ["bootout", `gui/${process.getuid?.() ?? 0}/${names.label}`]).catch(() => {});
    await rm(launchdPath(home), { force: true });
  } else if (platform === "linux") {
    await run("systemctl", ["--user", "disable", "--now", names.unit]).catch(() => {});
    await rm(systemdPath(home), { force: true });
    await run("systemctl", ["--user", "daemon-reload"]).catch(() => {});
  } else if (platform === "win32") {
    await run("reg", ["delete", WINDOWS_RUN_KEY, "/v", names.runName, "/f"]).catch(() => {});
  }
}
