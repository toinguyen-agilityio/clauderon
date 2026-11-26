import { createHash } from "node:crypto";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Payload } from "@clauderon/protocol";
import { settle } from "@clauderon/testing";
import { TOKEN_GUIDANCE, claudeCommand, parseClaudeLine } from "../src/claude";
import { registerLoginHandlers } from "../src/logins";
import { registerNodeHandlers } from "../src/nodes";
import { registerWorkspaceHandlers } from "../src/workspace";
import { FakeLink, FakeSystem, gate } from "./fakes";

let system: FakeSystem;
let link: FakeLink;
const HOME = "/home/ann/.clauderon";
// The Agent builds paths with the platform's separator: `\` on Windows.
const CLONE = join(HOME, "projects", "acme", "web");
const run = (id: string) => join(HOME, "runs", id);

beforeEach(() => {
  system = new FakeSystem();
  link = new FakeLink();
  const log = () => {};
  registerLoginHandlers(link, system);
  registerWorkspaceHandlers(link, system, { home: HOME, log });
  registerNodeHandlers(link, system, { log, knownSecrets: ["machine-token-value"], home: HOME });
});

describe("Logins (POD-5)", () => {
  const claudeStatus = (status: object) => ({ stdout: `${JSON.stringify(status, null, 2)}\n` });

  it("machine.checkLogins reports both logins, the Claude account and plan, the gh account and the repositories it reaches", async () => {
    system.script(({ argv }) => {
      if (argv.join(" ") === "claude auth status") return claudeStatus({ loggedIn: true, authMethod: "claude.ai", email: "ann@example.com", subscriptionType: "max" });
      if (argv.includes(".login")) return { stdout: "octocat\n" };
      if (argv.includes(".[].full_name")) return { stdout: "acme/web\nacme/api\n" };
      return undefined;
    });
    await link.deliver("machine.checkLogins", {});
    expect(link.of("machine.logins")).toEqual([
      {
        claude: true,
        claudeAccount: "ann@example.com",
        claudePlan: "max",
        gh: true,
        ghAccount: "octocat",
        tokenRepos: ["acme/web", "acme/api"],
        checkedAt: expect.any(String),
      },
    ]);
  });

  it("a logged-out gh or Claude Code reads as false, with no account", async () => {
    system.script(({ argv }) => {
      if (argv.join(" ") === "claude auth status") return { exitCode: 1, ...claudeStatus({ loggedIn: false }) };
      return argv.join(" ") === "gh auth status" ? { exitCode: 1 } : undefined;
    });
    await link.deliver("machine.checkLogins", {});
    expect(link.of("machine.logins")[0]).toMatchObject({ claude: false, claudeAccount: null, gh: false, ghAccount: null, tokenRepos: [] });
  });

  it("an older Claude Code without a JSON status falls back to the exit code, with no account", async () => {
    system.script(({ argv }) => (argv.join(" ") === "claude auth status" ? { stdout: "Logged in\n" } : undefined));
    await link.deliver("machine.checkLogins", {});
    expect(link.of("machine.logins")[0]).toMatchObject({ claude: true, claudeAccount: null, claudePlan: null });
    expect(system.execs.some((e) => e.script.includes(".credentials.json"))).toBe(true);
  });
});

describe("workspace.prepare (T1-16, POD-10, RUN-3)", () => {
  const prepare = (runId: string, branch: string) => ({ runId, owner: "acme", repo: "web", baseBranch: "main", branch });

  it("clones once with gh into the Agent's own directory, then only fetches; each Run gets its worktree and branch", async () => {
    await link.deliver("workspace.prepare", prepare("run-1", "clauderon/1-a-run1"));
    await link.deliver("workspace.prepare", prepare("run-2", "clauderon/2-b-run2"));

    const commands = system.commands();
    expect(commands.filter((c) => c.startsWith("gh repo clone"))).toEqual([`gh repo clone acme/web ${CLONE}`]);
    expect(commands.filter((c) => c.includes(" fetch "))).toEqual([`git -C ${CLONE} fetch origin main`]);
    expect(commands.filter((c) => c.includes("worktree add"))).toEqual([
      `git -C ${CLONE} worktree add ${run("run-1")} -b clauderon/1-a-run1 origin/main`,
      `git -C ${CLONE} worktree add ${run("run-2")} -b clauderon/2-b-run2 origin/main`,
    ]);
    expect(link.of("workspace.ready")).toEqual([
      { runId: "run-1", worktreePath: run("run-1") },
      { runId: "run-2", worktreePath: run("run-2") },
    ]);
  });

  it("clones once when a Batch prepares two Runs of the same Project at once", async () => {
    await Promise.all([
      link.deliver("workspace.prepare", prepare("run-1", "clauderon/1-a-run1")),
      link.deliver("workspace.prepare", prepare("run-2", "clauderon/2-b-run2")),
    ]);

    expect(system.commands().filter((c) => c.startsWith("gh repo clone"))).toHaveLength(1);
    expect(link.of("workspace.failed")).toEqual([]);
    expect(link.of("workspace.ready").map((r) => r.runId).sort()).toEqual(["run-1", "run-2"]);
  });

  it("sets a git identity only in the clone's own config, never the Member's global one", async () => {
    await link.deliver("workspace.prepare", prepare("run-1", "clauderon/1-a-run1"));
    const identity = system.execs.find((e) => e.script.includes("user.name"))!;
    expect(identity.args).toEqual([CLONE]);
    expect(identity.script).not.toContain("--global");
  });

  it("reports workspace.failed with the masked error", async () => {
    system.script(({ argv }) => (argv.includes("clone") ? { exitCode: 1, stderr: "auth failed for ghp_abcdefghijklmnopqrstuvwxyz0123" } : undefined));
    await link.deliver("workspace.prepare", prepare("run-1", "clauderon/1-a-run1"));
    expect(link.of("workspace.failed")).toEqual([{ runId: "run-1", error: expect.stringContaining("•••") }]);
    expect(JSON.stringify(link.sent)).not.toContain("ghp_");
  });

  it("refuses unsafe names", async () => {
    await link.deliver("workspace.prepare", { ...prepare("run-1", "x; rm -rf /"), branch: "x; rm -rf /" });
    expect(link.of("workspace.failed")).toHaveLength(1);
    expect(system.execs).toHaveLength(0);
  });
});

describe("a Run's attached files (ADR 0011)", () => {
  const hex = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
  const pdf = new TextEncoder().encode("%PDF-1.7");
  const file = { id: "att-a", name: "spec v2.pdf", size: pdf.length, sha256: hex(pdf) };
  const prepare = (attachments: Payload<"workspace.prepare">["attachments"]) => ({ runId: "run-1", owner: "acme", repo: "web", baseBranch: "main", branch: "clauderon/run-1", attachments });
  const inWorktree = (name: string) => join(run("run-1"), ".clauderon", "inputs", name);
  const EXCLUDE = join(CLONE, ".git", "info", "exclude");

  function agentWith(download?: (id: string) => Promise<Uint8Array>) {
    const sys = new FakeSystem();
    const lnk = new FakeLink();
    registerWorkspaceHandlers(lnk, sys, { home: HOME, log: () => {}, download });
    return { sys, lnk };
  }

  it("downloads each file into the worktree, checked, keeps .clauderon/ out of git once, and says how many it wrote", async () => {
    const asked: string[] = [];
    const { sys, lnk } = agentWith(async (id) => (asked.push(id), pdf));
    sys.files.set(EXCLUDE, "# git ls-files --others --exclude-from=.git/info/exclude");
    await lnk.deliver("workspace.prepare", prepare([file]));
    await lnk.deliver("workspace.prepare", { ...prepare([]), runId: "run-2", branch: "clauderon/run-2" });

    expect(asked).toEqual(["att-a"]);
    expect(sys.bytes.get(inWorktree("spec v2.pdf"))).toEqual(pdf);
    expect(sys.files.get(EXCLUDE)).toBe("# git ls-files --others --exclude-from=.git/info/exclude\n.clauderon/\n");
    expect(lnk.of("workspace.ready")).toEqual([
      { runId: "run-1", worktreePath: run("run-1"), attachments: 1 },
      { runId: "run-2", worktreePath: run("run-2") },
    ]);
  });

  it("fails the Workspace on a damaged file, an unsafe name, or an Agent that cannot download", async () => {
    const damaged = agentWith(async () => new TextEncoder().encode("%PDF-1.6"));
    await damaged.lnk.deliver("workspace.prepare", prepare([file]));
    expect(damaged.lnk.of("workspace.failed")).toEqual([{ runId: "run-1", error: "spec v2.pdf arrived damaged" }]);
    expect(damaged.lnk.of("workspace.ready")).toEqual([]);

    const unsafe = agentWith(async () => pdf);
    await unsafe.lnk.deliver("workspace.prepare", prepare([{ ...file, name: "../../.bashrc" }]));
    expect(unsafe.lnk.of("workspace.failed")[0]!.error).toContain("unsafe file name");
    expect(unsafe.sys.bytes.size).toBe(0);

    const old = agentWith();
    await old.lnk.deliver("workspace.prepare", prepare([file]));
    expect(old.lnk.of("workspace.failed")[0]!.error).toBe("This Agent cannot download attached files");
  });

  it("a Node checks the files are still in the worktree, and fails with what to do when one is gone", async () => {
    await link.deliver("node.run", nodeRun({ kind: "command", command: "true", attachments: [{ name: file.name, sha256: file.sha256 }] }));
    expect(link.of("node.result")).toEqual([{ attemptId: "att-1", exitCode: -1, error: "The attached file spec v2.pdf is no longer in the worktree. Start a new Run with it." }]);

    scriptGit(["h1", "h1"]);
    await system.writeBytes(join("/home/ann/.clauderon/runs/run-1", ".clauderon", "inputs", file.name), pdf);
    await link.deliver("node.run", nodeRun({ kind: "command", command: "true", attachments: [{ name: file.name, sha256: file.sha256 }] }));
    expect(link.of("node.result")[1]).toMatchObject({ exitCode: 0 });
  });
});

describe("workspace.cleanup (RUN-14, T4-7)", () => {
  const cleanup = (runId: string, branch: string) => ({ runId, worktreePath: run(runId), owner: "acme", repo: "web", branch });
  const hasWorktree = () => {
    system.paths.add(join(CLONE, ".git"));
    system.paths.add(run("run-1"));
  };

  it("removes the Run's worktree and its local branch, then says so; the remote branch is left alone", async () => {
    hasWorktree();
    // The branch exists locally; git removes the directory.
    system.script(({ argv }) => {
      if (argv.includes("remove")) system.paths.delete(run("run-1"));
      return undefined;
    });
    await link.deliver("workspace.cleanup", cleanup("run-1", "clauderon/1-a-run1"));

    expect(system.commands().filter((c) => c.startsWith("git"))).toEqual([
      `git -C ${CLONE} worktree remove --force ${run("run-1")}`,
      `git -C ${CLONE} worktree prune`,
      `git -C ${CLONE} show-ref --verify --quiet refs/heads/clauderon/1-a-run1`,
      `git -C ${CLONE} branch -D clauderon/1-a-run1`,
    ]);
    expect(system.commands().join(" ")).not.toContain("push");
    expect(link.of("workspace.cleaned")).toEqual([{ runId: "run-1" }]);
  });

  it("is a success when it was cleaned already: no worktree and no local branch", async () => {
    system.paths.add(join(CLONE, ".git"));
    system.script(({ argv }) => (argv.includes("show-ref") ? { exitCode: 1 } : undefined));
    await link.deliver("workspace.cleanup", cleanup("run-1", "clauderon/1-a-run1"));
    expect(system.commands().some((c) => c.includes("worktree remove") || c.includes("branch -D"))).toBe(false);
    expect(link.of("workspace.cleaned")).toEqual([{ runId: "run-1" }]);
  });

  it("a failed removal is logged and not answered, so the Gateway asks again on the next connect", async () => {
    hasWorktree();
    system.script(({ argv }) => (argv.includes("remove") ? { exitCode: 1, stderr: "Permission denied" } : undefined));
    await link.deliver("workspace.cleanup", cleanup("run-1", "clauderon/1-a-run1"));
    expect(link.of("workspace.cleaned")).toEqual([]);
    expect(link.of("workspace.failed")).toEqual([]);
  });

  it("refuses a path that is not the Run's own worktree, and unsafe names", async () => {
    hasWorktree();
    await link.deliver("workspace.cleanup", { ...cleanup("run-1", "clauderon/1-a-run1"), worktreePath: "/home/ann/Documents" });
    await link.deliver("workspace.cleanup", cleanup("run-1", "x; rm -rf /"));
    expect(system.execs).toHaveLength(0);
    expect(link.of("workspace.cleaned")).toEqual([]);
  });
});

/** Scripts git: HEAD moves when `commits` is set; the git dir is fixed. */
function scriptGit(heads: string[]) {
  system.script(({ argv }) => {
    if (argv[0] !== "git") return undefined;
    if (argv.includes("--absolute-git-dir")) return { stdout: "/home/ann/.clauderon/projects/acme/web/.git/worktrees/run-1\n" };
    if (argv.includes("HEAD")) return { stdout: `${heads.shift() ?? "same"}\n` };
    return undefined;
  });
}

const nodeRun = (extra: Partial<Payload<"node.run">> & Pick<Payload<"node.run">, "kind">): Payload<"node.run"> => ({
  attemptId: "att-1",
  runId: "run-1",
  worktreePath: "/home/ann/.clauderon/runs/run-1",
  env: {},
  ...extra,
});

describe("Command Nodes (RUN-10)", () => {
  it("drops terminal colour codes from the log and the test-result", async () => {
    scriptGit(["h1", "h1"]);
    system.script(({ argv }) => (argv[0] === "bash" && argv[1] === "-lc" ? { stdout: "\u001b[0mGET /health \u001b[32m200\u001b[0m 2 ms\nok 1\n" } : undefined));
    await link.deliver("node.run", nodeRun({ kind: "command", command: "npm test" }));

    expect((link.of("node.result")[0]!.result as { tail: string }).tail).toBe("GET /health 200 2 ms\nok 1");
    expect(link.of("node.log").map((l) => l.text)).toEqual(["GET /health 200 2 ms", "ok 1"]);
  });

  it("exit 0 succeeds; test-result holds the last 200 lines; env inputs become files", async () => {
    scriptGit(["h1", "h1"]);
    const lines = Array.from({ length: 250 }, (_, i) => `line ${i}`).join("\n");
    system.script(({ argv }) => (argv[0] === "bash" && argv[1] === "-lc" ? { stdout: `${lines}\n` } : undefined));
    await link.deliver("node.run", nodeRun({ kind: "command", command: "npm test", env: { CLAUDERON_BRANCH: "b", CLAUDERON_SUMMARY: "did it" } }));

    const [result] = link.of("node.result");
    expect(result).toMatchObject({ attemptId: "att-1", exitCode: 0, headCommit: "h1" });
    const tail = (result!.result as { tail: string }).tail.split("\n");
    expect(tail).toHaveLength(200);
    expect(tail[0]).toBe("line 50");
    expect(link.of("node.log").map((l) => l.seq)).toEqual(Array.from({ length: 250 }, (_, i) => i));

    const command = system.execs.find((e) => e.argv[2] === "npm test")!;
    expect(command.options).toMatchObject({ cwd: "/home/ann/.clauderon/runs/run-1" });
    expect(command.options.env).toEqual({
      CLAUDERON_ATTEMPT_ID: "att-1",
      CLAUDERON_BRANCH: "b",
      CLAUDERON_SUMMARY_FILE: "/home/ann/.clauderon/projects/acme/web/.git/worktrees/run-1/clauderon-att-1-clauderon_summary",
    });
  });

  it("a non-zero exit fails with its code", async () => {
    scriptGit(["h1", "h1"]);
    system.script(({ argv }) => (argv[2] === "false" ? { exitCode: 3 } : undefined));
    await link.deliver("node.run", nodeRun({ kind: "command", command: "false" }));
    expect(link.of("node.result")[0]).toMatchObject({ exitCode: 3, error: "Command exited 3" });
  });

  it("reads the pull request line printed by clauderon-open-pr", async () => {
    scriptGit(["h1", "h1"]);
    system.script(({ argv }) =>
      argv[2] === "clauderon-open-pr" ? { stdout: 'pushing\n{"pullRequest": {"number": 12, "url": "https://github.com/acme/web/pull/12"}}\n' } : undefined,
    );
    await link.deliver("node.run", nodeRun({ kind: "command", command: "clauderon-open-pr" }));
    expect(link.of("node.result")[0]!.result).toEqual({
      tail: 'pushing\n{"pullRequest": {"number": 12, "url": "https://github.com/acme/web/pull/12"}}',
      pullRequest: { number: 12, url: "https://github.com/acme/web/pull/12" },
    });
  });

  it("T1-15: masks tokens, the gh token and known secrets before sending", async () => {
    scriptGit(["h1", "h1"]);
    system.script(({ argv }) => (argv.join(" ") === "gh auth token" ? { stdout: "gho_ownertokenownertokenownertoken12\n" } : undefined));
    system.script(({ argv }) =>
      argv[2] === "env"
        ? { stdout: "token ghp_abcdefghijklmnopqrstuvwxyz0123\nsecret machine-token-value\n", stderr: "plain stderr\n" }
        : undefined,
    );
    await link.deliver("node.run", nodeRun({ kind: "command", command: "env" }));
    const text = link.of("node.log").map((l) => l.text);
    expect(text).toEqual(["token •••", "secret •••", "plain stderr"]);
    expect(JSON.stringify(link.sent)).not.toMatch(/ghp_|machine-token-value|gho_/);
  });
});

describe("node.kill (RUN-8)", () => {
  it("signals the Node's whole process group; an ended or unknown Attempt is a no-op", async () => {
    scriptGit(["h1", "h1"]);
    const held = gate();
    system.script(({ argv }) => (argv[2] === "sleep 100" ? { until: held.promise } : undefined));
    await link.deliver("node.run", nodeRun({ kind: "command", command: "sleep 100" }));
    await link.deliver("node.kill", { attemptId: "other" });
    await link.deliver("node.kill", { attemptId: "att-1" });

    const sleep = system.execs.find((e) => e.argv[2] === "sleep 100")!;
    expect(system.kills).toEqual([{ pid: sleep.pid, signal: "TERM" }]);

    held.open();
    await settle();
    await link.deliver("node.kill", { attemptId: "att-1" });
    expect(system.kills).toHaveLength(1);
  });
});

describe("Agent Nodes (RUN-10, POD-12)", () => {
  const stream = [
    { type: "system", subtype: "init", session_id: "sess-1" },
    { type: "assistant", message: { content: [{ type: "text", text: "Working on it" }, { type: "tool_use", name: "Edit", input: { file: "a.ts" } }] } },
    {
      type: "result",
      subtype: "success",
      session_id: "sess-1",
      result: 'Done.\n```json\n{"outputs": {"summary": "Fixed totals"}}\n```',
      usage: { input_tokens: 10, cache_read_input_tokens: 5, output_tokens: 7 },
    },
  ]
    .map((e) => JSON.stringify(e))
    .join("\n");

  it("writes the prompt into the git dir, runs Claude Code headless and returns the parsed result", async () => {
    scriptGit(["h1", "h2"]);
    system.script(({ argv }) => (argv[2]?.startsWith("claude ") ? { stdout: `${stream}\n` } : undefined));
    await link.deliver("node.run", nodeRun({ kind: "agent", prompt: "Do the thing", env: { CLAUDERON_EXPECT_COMMIT: "1" } }));

    expect(system.files.get("/home/ann/.clauderon/projects/acme/web/.git/worktrees/run-1/clauderon-prompt-att-1.md")).toBe("Do the thing");
    const claude = system.execs.find((e) => e.argv[2]?.startsWith("claude "))!;
    expect(claude.argv[2]).toBe(`claude -p --output-format stream-json --verbose --dangerously-skip-permissions --append-system-prompt '${TOKEN_GUIDANCE}' < "$CLAUDERON_PROMPT_FILE"`);
    expect(claude.options.cwd).toBe("/home/ann/.clauderon/runs/run-1");

    expect(link.of("node.usage")).toEqual([{ attemptId: "att-1", inputTokens: 15, outputTokens: 7, cacheCreated: 0, cacheRead: 5 }]);
    expect(link.of("node.result")).toEqual([
      { attemptId: "att-1", exitCode: 0, result: { outputs: { summary: "Fixed totals" } }, sessionId: "sess-1", headCommit: "h2" },
    ]);
    expect(link.of("node.log").map((l) => l.text)).toContain("[tool] Edit {\"file\":\"a.ts\"}");
  });

  it("a branch Output needs a commit: HEAD that did not move fails with 'no commit on the branch'", async () => {
    scriptGit(["h1", "h1"]);
    system.script(({ argv }) => (argv[2]?.startsWith("claude ") ? { stdout: `${stream}\n` } : undefined));
    await link.deliver("node.run", nodeRun({ kind: "agent", prompt: "p", env: { CLAUDERON_EXPECT_COMMIT: "1" } }));
    expect(link.of("node.result")[0]).toMatchObject({ error: "no commit on the branch" });
  });

  it("a usage limit fails with Claude's own message, not just the exit code", async () => {
    scriptGit(["h1", "h1"]);
    const limit = [
      { type: "system", subtype: "init", session_id: "sess-1" },
      { type: "assistant", session_id: "sess-1", message: { content: [{ type: "text", text: "You've hit your 5-hour limit · resets 5:40am (UTC)" }] } },
      { type: "result", subtype: "success", is_error: true, session_id: "sess-1", result: "You've hit your 5-hour limit · resets 5:40am (UTC)" },
    ]
      .map((e) => JSON.stringify(e))
      .join("\n");
    system.script(({ argv }) => (argv[2]?.startsWith("claude ") ? { exitCode: 1, stdout: `${limit}\n` } : undefined));
    await link.deliver("node.run", nodeRun({ kind: "agent", prompt: "p" }));
    expect(link.of("node.result")[0]).toMatchObject({ exitCode: 1, error: "Claude Code exited 1: You've hit your 5-hour limit · resets 5:40am (UTC)" });
  });

  it("without a result event, a failed Claude Code run uses its last stderr line, masked", async () => {
    scriptGit(["h1", "h1"]);
    system.script(({ argv }) =>
      argv[2]?.startsWith("claude ") ? { exitCode: 1, stderr: "starting\nAPI Error: 401 invalid key machine-token-value\n\n" } : undefined,
    );
    await link.deliver("node.run", nodeRun({ kind: "agent", prompt: "p" }));
    expect(link.of("node.result")[0]!.error).toBe("Claude Code exited 1: API Error: 401 invalid key •••");
  });

  it("sends the per-turn summary before the result, sizes only (#105)", async () => {
    scriptGit(["h1", "h2"]);
    const events = [
      { type: "assistant", message: { id: "m1", usage: { input_tokens: 2, cache_creation_input_tokens: 10, cache_read_input_tokens: 100, output_tokens: 5 }, content: [{ type: "tool_use", id: "t1", name: "Read", input: { file_path: "/home/ann/.clauderon/runs/run-1/a.ts" } }] } },
      { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "secret file contents" }] } },
      { type: "result", subtype: "success", result: "ok", usage: { input_tokens: 2, output_tokens: 5 } },
    ]
      .map((e) => JSON.stringify(e))
      .join("\n");
    system.script(({ argv }) => (argv[2]?.startsWith("claude ") ? { stdout: `${events}\n` } : undefined));
    await link.deliver("node.run", nodeRun({ kind: "agent", prompt: "p" }));

    const [sent] = link.of("node.turns");
    expect(sent).toEqual({
      attemptId: "att-1",
      turns: [{ index: 0, calls: [{ tool: "Read", target: "a.ts", resultBytes: 20 }], newInput: 2, cacheCreated: 10, cacheRead: 100, output: 5 }],
    });
    expect(JSON.stringify(sent)).not.toContain("secret file contents");
  });

  it("sends a session longer than one message holds in several, without losing a turn (#105)", async () => {
    scriptGit(["h1", "h2"]);
    const events = Array.from({ length: 2001 }, (_, i) =>
      JSON.stringify({ type: "assistant", message: { id: `m${i}`, usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: "." }] } }),
    ).join("\n");
    system.script(({ argv }) => (argv[2]?.startsWith("claude ") ? { stdout: `${events}\n` } : undefined));
    await link.deliver("node.run", nodeRun({ kind: "agent", prompt: "p" }));

    const sent = link.of("node.turns");
    expect(sent.map((m) => m.turns.length)).toEqual([2000, 1]);
  });

  it("a failed Claude Code run with nothing to say falls back to the exit code", async () => {
    scriptGit(["h1", "h1"]);
    system.script(({ argv }) => (argv[2]?.startsWith("claude ") ? { exitCode: 2, stdout: '{"type":"system","subtype":"init"}\nWorking on it\n' } : undefined));
    await link.deliver("node.run", nodeRun({ kind: "agent", prompt: "p" }));
    expect(link.of("node.result")[0]!.error).toBe("Claude Code exited 2");
  });

  it("parses a line that is not JSON as a plain log line", () => {
    expect(parseClaudeLine("plain")).toEqual({ log: "plain" });
    // Subagents and earlier resumed rounds are only in `modelUsage`, summed over every model.
    const withModels = parseClaudeLine(
      JSON.stringify({
        type: "result",
        result: "",
        usage: { input_tokens: 1, cache_read_input_tokens: 2, output_tokens: 3 },
        modelUsage: {
          main: { inputTokens: 10, cacheCreationInputTokens: 20, cacheReadInputTokens: 30, outputTokens: 40 },
          sub: { inputTokens: 1, cacheCreationInputTokens: 2, cacheReadInputTokens: 3, outputTokens: 4 },
        },
      }),
    );
    expect(withModels.usage).toEqual({ inputTokens: 66, outputTokens: 44, cacheCreated: 22, cacheRead: 33 });
  });
});

describe("claudeCommand (#218)", () => {
  it("appends the short token guidance, also to a resumed session", () => {
    expect(TOKEN_GUIDANCE).not.toContain("'");
    expect(claudeCommand()).toContain(`--append-system-prompt '${TOKEN_GUIDANCE}'`);
    expect(claudeCommand({ resumeSessionId: "sess-1" })).toMatch(/--resume 'sess-1' --append-system-prompt '/);
  });
});
