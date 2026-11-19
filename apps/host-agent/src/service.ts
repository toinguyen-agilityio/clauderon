import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

// Runs the Agent whenever the Member is logged in (ADR 0006), under their own
// user, so Runs use their own Claude Code and gh logins: a launchd user agent
// on macOS, a systemd user unit on Linux, a logon Scheduled Task on Windows.
// Never root or a system service.

export const SERVICE_LABEL = "com.clauderon.agent";
const SYSTEMD_UNIT = "clauderon-agent.service";
const WINDOWS_TASK = "Clauderon Agent";

/** How the service starts the Agent: this Node, from this checkout, with this home. */
export type ServiceSpec = {
  /** Absolute path of the Node binary. */
  node: string;
  /** The repository checkout the Agent runs from (its root). */
  repo: string;
  home: string;
};

/** The command line, run from the repository root: `node --import tsx apps/host-agent/src/main.ts run`. */
export const serviceArgs = (spec: ServiceSpec) => [spec.node, "--import", "tsx", join(spec.repo, "apps", "host-agent", "src", "main.ts"), "run"];

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
  <string>${SERVICE_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>WorkingDirectory</key>
  <string>${xml(spec.repo)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>CLAUDERON_HOME</key>
    <string>${xml(spec.home)}</string>
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
WorkingDirectory=${spec.repo}
Environment=CLAUDERON_HOME=${systemdQuote(spec.home)}
ExecStart=${serviceArgs(spec).map(systemdQuote).join(" ")}
Restart=on-failure
RestartSec=10
StandardOutput=append:${logFile(spec)}
StandardError=append:${logFile(spec)}

[Install]
WantedBy=default.target
`;
}

/** A `cmd` line for the Scheduled Task: sets the home, then runs the Agent from the checkout, logging to a file. */
export function windowsTaskCommand(spec: ServiceSpec): string {
  const quote = (a: string) => `"${a}"`;
  const run = serviceArgs(spec).map(quote).join(" ");
  return `cmd /c "set CLAUDERON_HOME=${spec.home}&& cd /d ${quote(spec.repo)} && ${run} >> ${quote(logFile(spec))} 2>&1"`;
}

export const launchdPath = () => join(homedir(), "Library", "LaunchAgents", `${SERVICE_LABEL}.plist`);
export const systemdPath = () => join(homedir(), ".config", "systemd", "user", SYSTEMD_UNIT);

type Exec = (file: string, args: readonly string[]) => Promise<void>;
const exec: Exec = async (file, args) => {
  await promisify(execFile)(file, [...args]);
};

async function write(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

/** Installs, or replaces, the service and starts it now. Returns where its log goes. */
export async function installService(spec: ServiceSpec, platform: NodeJS.Platform = process.platform, run: Exec = exec): Promise<string> {
  await mkdir(spec.home, { recursive: true });
  if (platform === "darwin") {
    const path = launchdPath();
    const domain = `gui/${process.getuid?.() ?? 0}`;
    await run("launchctl", ["bootout", `${domain}/${SERVICE_LABEL}`]).catch(() => {});
    await write(path, launchdPlist(spec));
    await run("launchctl", ["bootstrap", domain, path]);
  } else if (platform === "linux") {
    await write(systemdPath(), systemdUnit(spec));
    await run("systemctl", ["--user", "daemon-reload"]);
    await run("systemctl", ["--user", "enable", "--now", SYSTEMD_UNIT]);
    await run("systemctl", ["--user", "restart", SYSTEMD_UNIT]);
  } else if (platform === "win32") {
    await run("schtasks", ["/Create", "/F", "/SC", "ONLOGON", "/TN", WINDOWS_TASK, "/TR", windowsTaskCommand(spec)]);
    await run("schtasks", ["/Run", "/TN", WINDOWS_TASK]);
  } else {
    throw new Error(`no service support for ${platform}: run the Agent with start instead`);
  }
  return logFile(spec);
}

/** Stops and removes the service; a missing one is fine. */
export async function uninstallService(platform: NodeJS.Platform = process.platform, run: Exec = exec): Promise<void> {
  if (platform === "darwin") {
    await run("launchctl", ["bootout", `gui/${process.getuid?.() ?? 0}/${SERVICE_LABEL}`]).catch(() => {});
    await rm(launchdPath(), { force: true });
  } else if (platform === "linux") {
    await run("systemctl", ["--user", "disable", "--now", SYSTEMD_UNIT]).catch(() => {});
    await rm(systemdPath(), { force: true });
    await run("systemctl", ["--user", "daemon-reload"]).catch(() => {});
  } else if (platform === "win32") {
    await run("schtasks", ["/End", "/TN", WINDOWS_TASK]).catch(() => {});
    await run("schtasks", ["/Delete", "/F", "/TN", WINDOWS_TASK]).catch(() => {});
  }
}
