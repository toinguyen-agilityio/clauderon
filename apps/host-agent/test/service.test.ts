import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { installService, launchdPlist, serviceArgs, systemdUnit, uninstallService, windowsHidden, windowsLauncher, windowsRunCommand, type ServiceSpec } from "../src/service";

// A bundled Agent (ADR 0007): its own Node and agent.mjs under the home.
const spec: ServiceSpec = {
  node: "/Users/ann/.clauderon/node/bin/node",
  args: ["/Users/ann/.clauderon/agent/agent.mjs", "run"],
  cwd: "/Users/ann/.clauderon",
  home: "/Users/ann/.clauderon",
};

describe("Agent service (ADR 0006)", () => {
  it("runs the bundle with the Agent's own Node", () => {
    expect(serviceArgs(spec)).toEqual(["/Users/ann/.clauderon/node/bin/node", "/Users/ann/.clauderon/agent/agent.mjs", "run"]);
  });

  it("launchd: a user agent that restarts only after a crash, logging to the home", () => {
    const plist = launchdPlist({ ...spec, cwd: "/Users/ann/R&D/clauderon" });
    expect(plist).toContain("<string>com.clauderon.agent</string>");
    expect(plist).toContain("<string>/Users/ann/R&amp;D/clauderon</string>");
    expect(plist).toMatch(/<key>SuccessfulExit<\/key>\s*<false\/>/);
    expect(plist).toContain(`<string>${join("/Users/ann/.clauderon", "agent.log")}</string>`);
    // Marks a service run: an updated Agent exits non-zero so launchd starts the new file.
    expect(plist).toMatch(/<key>CLAUDERON_SERVICE<\/key>\s*<string>1<\/string>/);
  });

  it("systemd: a user unit with Restart=on-failure, quoting paths with spaces", () => {
    const unit = systemdUnit({ ...spec, home: "/home/ann/my agent" });
    expect(unit).toContain("Restart=on-failure");
    expect(unit).toContain('Environment=CLAUDERON_HOME="/home/ann/my agent"');
    expect(unit).toContain("WantedBy=default.target");
    expect(unit).toContain("Environment=CLAUDERON_SERVICE=1");
  });

  it("keeps the installing shell's PATH, so tools set up for zsh only (claude in ~/.local/bin) are found", () => {
    const path = "/Users/ann/.local/bin:/usr/bin:/bin";
    expect(launchdPlist({ ...spec, path })).toMatch(/<key>PATH<\/key>\s*<string>\/Users\/ann\/\.local\/bin:\/usr\/bin:\/bin<\/string>/);
    expect(systemdUnit({ ...spec, path: "/home/ann/my tools:/usr/bin" })).toContain('Environment=PATH="/home/ann/my tools:/usr/bin"\nExecStart=');
    expect(launchdPlist(spec)).not.toContain("<key>PATH</key>");
    expect(systemdUnit(spec)).not.toContain("Environment=PATH");
  });

  it("Windows: the Run key starts a launcher script that sets the home and logs to a file", () => {
    const home = join("C:", "Users", "Toi Nguyen", ".clauderon");
    const s = { node: join(home, "node", "node.exe"), args: [join(home, "agent", "agent.mjs"), "run"], cwd: home, home };
    expect(windowsRunCommand(s)).toBe(`wscript.exe //B //Nologo "${join(home, "agent-service.vbs")}"`);
    expect(windowsHidden(s)).toBe(`CreateObject("WScript.Shell").Run """${join(home, "agent-service.cmd")}""", 0, False\r\n`);
    const script = windowsLauncher(s);
    expect(script).toContain(`set "CLAUDERON_HOME=${home}"`);
    expect(script).toContain("set CLAUDERON_SERVICE=1");
    expect(script).toContain(`cd /d "${home}"`);
    expect(script).toContain(`"${join(home, "agent", "agent.mjs")}" "run" >> "${join(home, "agent.log")}" 2>&1`);
  });

  it("installs and removes a per-user Windows Run key, with no administrator rights", async () => {
    const calls: string[][] = [];
    const launched: string[] = [];
    const run = async (file: string, args: readonly string[]) => void calls.push([file, ...args]);
    await installService({ ...spec, home: `${process.cwd()}/.tmp-service-home` }, "win32", run, (f) => void launched.push(f));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.slice(0, 2)).toEqual(["reg", "add"]);
    expect(calls[0]![2]).toMatch(/^HKCU\\/);
    expect(launched).toHaveLength(1);
    calls.length = 0;
    await uninstallService("win32", run);
    expect(calls.map((c) => c.slice(0, 2))).toEqual([["reg", "delete"]]);
  });
});
