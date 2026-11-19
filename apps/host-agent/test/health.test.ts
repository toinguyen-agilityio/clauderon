import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixFor, runDoctor, type DoctorInput } from "../src/doctor";
import { checkGateway } from "../src/gateway-check";
import { mergePaths, parsePathOutput, printPathCommand, shellPath } from "../src/tool-path";
import { updateAgent } from "../src/update";
import { FakeSystem } from "./fakes";

describe("tool PATH from the Member's login shell (ADR 0007)", () => {
  it("asks zsh or bash for $PATH, and fish for its list joined", () => {
    expect(printPathCommand("/bin/zsh")).toEqual(["/bin/zsh", "-l", "-i", "-c", expect.stringContaining('"$PATH"')]);
    expect(printPathCommand("/opt/homebrew/bin/fish")[4]).toContain("(string join : $PATH)");
  });

  it("reads the PATH between the markers, ignoring what the shell prints around them", () => {
    expect(parsePathOutput("Welcome!\n__CLAUDERON_PATH_START__/a:/b__CLAUDERON_PATH_END__\nbye")).toBe("/a:/b");
    expect(parsePathOutput("no markers")).toBeNull();
    expect(parsePathOutput("__CLAUDERON_PATH_START____CLAUDERON_PATH_END__")).toBeNull();
  });

  it("merges PATHs, earlier first, without duplicates", () => {
    expect(mergePaths(["/home/ann/.local/bin", "/usr/bin"].join(delimiter), null, ["/usr/bin", "/bin", ""].join(delimiter))).toBe(
      ["/home/ann/.local/bin", "/usr/bin", "/bin"].join(delimiter),
    );
  });

  it.skipIf(process.platform === "win32")("gets a real login shell's PATH", async () => {
    expect(await shellPath("/bin/sh")).toMatch(/\/bin/);
  });
});

describe("doctor (ADR 0007)", () => {
  const loggedIn = { claude: true, claudeAccount: "ann@example.com", claudePlan: "pro", gh: true, ghAccount: "ann" };
  const input = (system: FakeSystem, over: Partial<DoctorInput> = {}): DoctorInput => ({
    system,
    platform: "darwin",
    home: "/Users/ann/.clauderon",
    logins: loggedIn,
    gateway: { state: "paired", webUrl: "https://app.test", skewMs: 1000 },
    serviceInstalled: true,
    version: "0.4.0+abc",
    now: () => new Date("2026-11-19T10:00:00Z"),
    freeDiskGb: async () => 50,
    ...over,
  });
  const withTools = () =>
    new FakeSystem().script(({ argv }) => {
      const line = argv.join(" ");
      if (line === "git --version") return { stdout: "git version 2.50.1\n" };
      if (line === "gh --version") return { stdout: "gh version 2.102.0\n" };
      if (line === "claude --version") return { stdout: "2.1.0 (Claude Code)\n" };
      if (line === "git config --global user.name") return { stdout: "Ann\n" };
      if (line === "git config --global user.email") return { stdout: "ann@example.com\n" };
      if (argv[0] === "bash" && argv[3] === "claude") return { stdout: "/Users/ann/.local/bin/claude\n" };
      return undefined;
    });

  it("passes a Machine that has everything, and shows where each tool is", async () => {
    const report = await runDoctor(input(withTools()));
    expect(report.checks.filter((c) => c.status !== "ok")).toEqual([]);
    expect(report.checks.find((c) => c.id === "tool.claude")?.detail).toBe("2.1.0 (Claude Code) · /Users/ann/.local/bin/claude");
    expect(report.checkedAt).toBe("2026-11-19T10:00:00.000Z");
    // bash itself is only listed on Windows (Git Bash) or when it is missing.
    expect(report.checks.some((c) => c.id === "tool.bash")).toBe(false);
  });

  it("fails a missing tool or login with this OS's fix; only warns for git identity, clock, service and disk", async () => {
    const system = withTools().script(({ argv }) => {
      const line = argv.join(" ");
      if (line === "gh --version") return { exitCode: 127 };
      if (line.startsWith("git config")) return { exitCode: 1 };
      return undefined;
    });
    const report = await runDoctor(
      input(system, {
        platform: "win32",
        logins: { ...loggedIn, claude: false, claudeAccount: null, claudePlan: null },
        gateway: { state: "paired", webUrl: null, skewMs: 600_000 },
        serviceInstalled: false,
        freeDiskGb: async () => 2,
      }),
    );
    const byId = Object.fromEntries(report.checks.map((c) => [c.id, c]));
    expect(byId["tool.gh"]).toMatchObject({ status: "fail", fix: "winget install --id GitHub.cli -e" });
    expect(byId["login.claude"]).toMatchObject({ status: "fail", fix: "claude auth login" });
    expect(byId["tool.bash"]).toMatchObject({ status: "ok", title: "Git Bash" });
    for (const id of ["git.identity", "gateway.clock", "service", "disk"]) expect(byId[id]?.status).toBe("warn");
  });

  it("fails the pairing when the Gateway refuses the token, is unreachable, or there is none", async () => {
    const unpaired = await runDoctor(input(withTools(), { gateway: { state: "unpaired" } }));
    expect(unpaired.checks.find((c) => c.id === "gateway.paired")).toMatchObject({ status: "fail" });
    const down = await runDoctor(input(withTools(), { gateway: { state: "unreachable", error: "ECONNREFUSED" } }));
    expect(down.checks.find((c) => c.id === "gateway.reachable")).toMatchObject({ status: "fail", detail: "ECONNREFUSED" });
    const none = await runDoctor(input(withTools(), { gateway: null }));
    expect(none.checks.find((c) => c.id === "gateway.paired")?.detail).toContain("not paired yet");
  });

  it("without bash, says so instead of reporting every tool missing for the wrong reason", async () => {
    const system = new FakeSystem().script(() => ({ exitCode: -1 }));
    const report = await runDoctor(input(system, { platform: "linux" }));
    expect(report.checks[0]).toMatchObject({ id: "tool.bash", status: "fail" });
  });

  it("gives install steps per OS", () => {
    expect(fixFor("tool.gh", "darwin")).toBe("brew install gh");
    expect(fixFor("tool.claude", "linux")).toContain("claude.ai/install.sh");
    expect(fixFor("tool.git", "win32")).toContain("Git.Git");
  });
});

const respond = (routes: Record<string, () => Response>) =>
  (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    const route = routes[url];
    if (!route) throw new TypeError("fetch failed", { cause: new Error(`ECONNREFUSED ${url}`) });
    return route();
  }) as typeof fetch;

describe("Gateway token check (ADR 0007)", () => {
  it("reads paired, the web app and the clock skew; unpaired on 401; unreachable on a network error", async () => {
    const at = Date.parse("2026-11-19T10:00:00Z");
    const paired = respond({
      "https://gw.test/agent/check": () => Response.json({ paired: true, webUrl: "https://app.test" }, { headers: { date: new Date(at - 300_000).toUTCString() } }),
    });
    expect(await checkGateway("wss://gw.test", "tok", paired, () => at)).toEqual({ state: "paired", webUrl: "https://app.test", skewMs: 300_000 });
    const refused = respond({ "https://gw.test/agent/check": () => new Response(null, { status: 401 }) });
    expect(await checkGateway("wss://gw.test", "tok", refused)).toEqual({ state: "unpaired" });
    expect(await checkGateway("wss://gw.test", "tok", respond({}))).toEqual({ state: "unreachable", error: "ECONNREFUSED https://gw.test/agent/check" });
  });
});

describe("the Agent updating itself (ADR 0007)", () => {
  const bundle = "console.log('new');\n";
  const sha = createHash("sha256").update(bundle).digest("hex");
  const web = (manifest: object, body = bundle) =>
    respond({
      "https://app.test/agent/agent.json": () => Response.json(manifest),
      "https://app.test/agent/agent.mjs": () => new Response(body),
    });

  it("replaces its file with the web app's bundle when the version differs", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agent-update-"));
    const target = join(dir, "agent.mjs");
    await writeFile(target, "old");
    const result = await updateAgent({ webUrl: "https://app.test/", current: "0.4.0+old", target, http: web({ version: "0.4.0+new", sha256: sha, size: 20 }) });
    expect(result).toEqual({ updated: true, version: "0.4.0+new" });
    expect(await readFile(target, "utf8")).toBe(bundle);
  });

  it("keeps its file when up to date, when nothing is served, or when the download does not match", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agent-update-"));
    const target = join(dir, "agent.mjs");
    await writeFile(target, "old");
    const opts = { webUrl: "https://app.test", current: "0.4.0+same", target };
    expect(await updateAgent({ ...opts, http: web({ version: "0.4.0+same", sha256: sha }) })).toEqual({ updated: false, reason: "up to date" });
    expect((await updateAgent({ ...opts, http: respond({}) })).updated).toBe(false);
    expect(await updateAgent({ ...opts, http: web({ version: "0.4.0+new", sha256: sha }, "tampered") })).toEqual({
      updated: false,
      reason: "the download does not match its SHA-256",
    });
    expect(await readFile(target, "utf8")).toBe("old");
  });
});
