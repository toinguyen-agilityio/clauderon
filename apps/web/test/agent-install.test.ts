import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { agentHomeName, checkInstallInput, installCommandPs1, installCommandSh, installPs1, installSh } from "../src/server/agent-install";

const input = { webUrl: "https://clauderon.example.com/" };

describe("Agent installer (ADR 0007)", () => {
  it("installs its own Node and the bundle, keeps a working pairing, then the service and the doctor", () => {
    const sh = installSh(input);
    expect(sh).toContain("WEB_URL='https://clauderon.example.com'");
    // Node from nodejs.org, checked against SHASUMS256; the bundle from the web app, checked against its manifest.
    expect(sh).toContain('BASE="https://nodejs.org/dist/latest-v$NODE_MAJOR.x"');
    expect(sh).toContain("does not match its SHA-256");
    expect(sh).toContain('curl -fsSL "$WEB_URL/agent/agent.mjs"');
    expect(sh).toContain('pair "$WEB_URL" --no-start --if-needed </dev/tty');
    expect(sh.indexOf(" pair ")).toBeLessThan(sh.indexOf("install-service"));
    expect(sh.indexOf("install-service")).toBeLessThan(sh.indexOf("doctor --no-fail"));
    // It says how to install a missing tool, never installs one, and never asks for root.
    expect(sh).not.toMatch(/^\s*sudo /m);
    expect(sh).not.toContain("git clone");
    // Valid POSIX shell.
    expect(() => execFileSync("sh", ["-n"], { input: sh })).not.toThrow();

    const ps1 = installPs1(input);
    expect(ps1).toContain("$WebUrl = 'https://clauderon.example.com'");
    expect(ps1).toContain("win-$Arch");
    // .NET, not Get-FileHash or Expand-Archive, which fail in Windows PowerShell started from PowerShell 7.
    expect(ps1).toContain("[Security.Cryptography.SHA256]::Create()");
    expect(ps1).not.toMatch(/Get-FileHash -|Expand-Archive -/);
    expect(ps1).toContain("pair $WebUrl --no-start --if-needed");
    expect(ps1).toContain("install-service");
  });

  it("refuses values that would need quoting in a piped script", () => {
    expect(() => checkInstallInput({ webUrl: "https://x.test/'; rm -rf ~; '" })).toThrow("unsafe web URL");
    expect(() => checkInstallInput({ webUrl: "file:///etc" })).toThrow("unsafe web URL");
    expect(() => checkInstallInput({ webUrl: "http://localhost:3000", homeName: "x; rm -rf ~" })).toThrow("unsafe Agent home");
    expect(() => checkInstallInput({ webUrl: "http://localhost:3000", homeName: "../.ssh" })).toThrow("unsafe Agent home");
    expect(checkInstallInput({ webUrl: "http://localhost:3000/" })).toEqual({ webUrl: "http://localhost:3000", homeName: ".clauderon" });
  });

  it("installs a dev web app's Agent into its own home, apart from the deployed app's", () => {
    expect(agentHomeName({ NODE_ENV: "production" })).toBe(".clauderon");
    expect(agentHomeName({ NODE_ENV: "development" })).toBe(".clauderon-dev");
    expect(agentHomeName({ NODE_ENV: "development", AGENT_HOME_NAME: ".clauderon-local" })).toBe(".clauderon-local");
    const sh = installSh({ webUrl: "http://localhost:3000", homeName: ".clauderon-dev" });
    expect(sh).toContain('HOME_DIR="${CLAUDERON_HOME:-$HOME/.clauderon-dev}"');
    // The Agent's own commands (pair, install-service, doctor) use the same home.
    expect(sh).toContain('export CLAUDERON_HOME="$HOME_DIR"');
    expect(() => execFileSync("sh", ["-n"], { input: sh })).not.toThrow();
    const ps1 = installPs1({ webUrl: "http://localhost:3000", homeName: ".clauderon-dev" });
    expect(ps1).toContain('Join-Path $HOME ".clauderon-dev"');
    expect(ps1).toContain("$env:CLAUDERON_HOME = $HomeDir");
    expect(installSh(input)).toContain('HOME_DIR="${CLAUDERON_HOME:-$HOME/.clauderon}"');
  });

  it("gives one line per OS", () => {
    expect(installCommandSh("https://c.test")).toBe("curl -fsSL https://c.test/agent/install.sh | sh");
    expect(installCommandPs1("https://c.test")).toBe("irm https://c.test/agent/install.ps1 | iex");
  });
});
