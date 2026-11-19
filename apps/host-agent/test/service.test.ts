import { describe, expect, it } from "vitest";
import { installService, launchdPlist, serviceArgs, systemdUnit, uninstallService, windowsTaskCommand, type ServiceSpec } from "../src/service";

const spec: ServiceSpec = { node: "/opt/node/bin/node", repo: "/Users/ann/src/clauderon", home: "/Users/ann/.clauderon" };

describe("Agent service (ADR 0006)", () => {
  it("runs main.ts with tsx from the checkout", () => {
    expect(serviceArgs(spec)).toEqual(["/opt/node/bin/node", "--import", "tsx", "/Users/ann/src/clauderon/apps/host-agent/src/main.ts", "run"]);
  });

  it("launchd: a user agent that restarts only after a crash, logging to the home", () => {
    const plist = launchdPlist({ ...spec, repo: "/Users/ann/R&D/clauderon" });
    expect(plist).toContain("<string>com.clauderon.agent</string>");
    expect(plist).toContain("<string>/Users/ann/R&amp;D/clauderon</string>");
    expect(plist).toMatch(/<key>SuccessfulExit<\/key>\s*<false\/>/);
    expect(plist).toContain("<string>/Users/ann/.clauderon/agent.log</string>");
  });

  it("systemd: a user unit with Restart=on-failure, quoting paths with spaces", () => {
    const unit = systemdUnit({ ...spec, home: "/home/ann/my agent" });
    expect(unit).toContain("Restart=on-failure");
    expect(unit).toContain('Environment=CLAUDERON_HOME="/home/ann/my agent"');
    expect(unit).toContain("WantedBy=default.target");
  });

  it("Windows: one cmd line that sets the home and logs to a file", () => {
    const cmd = windowsTaskCommand({ node: "C:\\node\\node.exe", repo: "C:\\src\\clauderon", home: "C:\\Users\\ann\\.clauderon" });
    expect(cmd).toContain("set CLAUDERON_HOME=C:\\Users\\ann\\.clauderon&&");
    expect(cmd).toContain('cd /d "C:\\src\\clauderon"');
    expect(cmd).toMatch(/>> "C:\\Users\\ann\\\.clauderon.agent\.log" 2>&1"$/);
  });

  it("installs and removes a Windows logon task under the Member's own user", async () => {
    const calls: string[][] = [];
    const run = async (file: string, args: readonly string[]) => void calls.push([file, ...args]);
    await installService({ ...spec, home: `${process.cwd()}/.tmp-service-home` }, "win32", run);
    expect(calls.map((c) => c.slice(0, 4))).toEqual([
      ["schtasks", "/Create", "/F", "/SC"],
      ["schtasks", "/Run", "/TN", "Clauderon Agent"],
    ]);
    expect(calls[0]).toContain("ONLOGON");
    expect(calls[0]).not.toContain("/RU");
    calls.length = 0;
    await uninstallService("win32", run);
    expect(calls.map((c) => c[1])).toEqual(["/End", "/Delete"]);
  });
});
