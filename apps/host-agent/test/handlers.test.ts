import { beforeEach, describe, expect, it } from "vitest";
import type { Payload } from "@clauderon/protocol";
import { settle } from "@clauderon/testing";
import { parseClaudeLine } from "../src/claude";
import { registerLoginHandlers } from "../src/logins";
import { registerNodeHandlers } from "../src/nodes";
import { registerWorkspaceHandlers } from "../src/workspace";
import { FakeLink, FakeSystem, gate } from "./fakes";

let system: FakeSystem;
let link: FakeLink;
const HOME = "/home/ann/.clauderon";

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
    expect(commands.filter((c) => c.startsWith("gh repo clone"))).toEqual(["gh repo clone acme/web /home/ann/.clauderon/projects/acme/web"]);
    expect(commands.filter((c) => c.includes(" fetch "))).toEqual(["git -C /home/ann/.clauderon/projects/acme/web fetch origin main"]);
    expect(commands.filter((c) => c.includes("worktree add"))).toEqual([
      "git -C /home/ann/.clauderon/projects/acme/web worktree add /home/ann/.clauderon/runs/run-1 -b clauderon/1-a-run1 origin/main",
      "git -C /home/ann/.clauderon/projects/acme/web worktree add /home/ann/.clauderon/runs/run-2 -b clauderon/2-b-run2 origin/main",
    ]);
    expect(link.of("workspace.ready")).toEqual([
      { runId: "run-1", worktreePath: "/home/ann/.clauderon/runs/run-1" },
      { runId: "run-2", worktreePath: "/home/ann/.clauderon/runs/run-2" },
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
    expect(identity.args).toEqual(["/home/ann/.clauderon/projects/acme/web"]);
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
    expect(claude.argv[2]).toBe('claude -p --output-format stream-json --verbose --dangerously-skip-permissions < "$CLAUDERON_PROMPT_FILE"');
    expect(claude.options.cwd).toBe("/home/ann/.clauderon/runs/run-1");

    expect(link.of("node.usage")).toEqual([{ attemptId: "att-1", inputTokens: 15, outputTokens: 7 }]);
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

  it("a failed Claude Code run with nothing to say falls back to the exit code", async () => {
    scriptGit(["h1", "h1"]);
    system.script(({ argv }) => (argv[2]?.startsWith("claude ") ? { exitCode: 2, stdout: '{"type":"system","subtype":"init"}\nWorking on it\n' } : undefined));
    await link.deliver("node.run", nodeRun({ kind: "agent", prompt: "p" }));
    expect(link.of("node.result")[0]!.error).toBe("Claude Code exited 2");
  });

  it("parses a line that is not JSON as a plain log line", () => {
    expect(parseClaudeLine("plain")).toEqual({ log: "plain" });
  });
});
