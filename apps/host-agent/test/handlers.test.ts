import { beforeEach, describe, expect, it } from "vitest";
import type { Payload } from "@clauderon/protocol";
import { parseClaudeLine } from "../src/claude";
import { registerNodeHandlers } from "../src/nodes";
import { registerPodHandlers } from "../src/pods";
import { registerTerminalHandlers } from "../src/terminals";
import { registerWorkspaceHandlers } from "../src/workspace";
import { FakeDocker, FakeLink } from "./fakes";

let docker: FakeDocker;
let link: FakeLink;

beforeEach(() => {
  docker = new FakeDocker();
  link = new FakeLink();
  const log = () => {};
  registerPodHandlers(link, docker, log);
  registerWorkspaceHandlers(link, docker, log);
  registerNodeHandlers(link, docker, { log, knownSecrets: ["host-secret-value"] });
  registerTerminalHandlers(link, docker, log);
});

const POD = "11111111-2222-3333-4444-555555555555";
const CONTAINER = `clauderon-pod-${POD}`;

describe("Pods (T1-16)", () => {
  it("pod.create creates the container with the volume, limits and user, starts it and reports its digest", async () => {
    await link.deliver("pod.create", { podId: POD, image: "ghcr.io/acme/clauderon-pod:1", cpus: 2, memoryMb: 4096 });
    expect(docker.containers.get(CONTAINER)).toEqual({
      name: CONTAINER,
      image: "ghcr.io/acme/clauderon-pod:1",
      volume: `clauderon-ws-${POD}`,
      cpus: 2,
      memoryMb: 4096,
      user: "pod",
      running: true,
    });
    expect(link.of("pod.status")).toEqual([{ podId: POD, status: "running", containerId: `id-${CONTAINER}`, imageDigest: "sha256:abc" }]);
  });

  it("POD-7: pod.delete removes the container and its Workspace volume, and a missing Pod is fine", async () => {
    await link.deliver("pod.create", { podId: POD, image: "img", cpus: 2, memoryMb: 4096 });
    await link.deliver("pod.delete", { podId: POD });
    expect(docker.containers.has(CONTAINER)).toBe(false);
    expect(docker.volumes.has(`clauderon-ws-${POD}`)).toBe(false);
    await link.deliver("pod.delete", { podId: "missing" });
    expect(link.of("pod.status").map((s) => s.status)).toEqual(["running"]);
  });

  it("start and stop report the new status; a failure reports error", async () => {
    await link.deliver("pod.create", { podId: POD, image: "img", cpus: 2, memoryMb: 4096 });
    await link.deliver("pod.stop", { podId: POD, image: "img", cpus: 2, memoryMb: 4096 });
    expect(docker.containers.get(CONTAINER)?.running).toBe(false);
    await link.deliver("pod.start", { podId: "missing", image: "img", cpus: 2, memoryMb: 4096 });
    expect(link.of("pod.status").map((s) => s.status)).toEqual(["running", "stopped", "error"]);
  });

  it("pod.checkLogins reports both logins, the gh account and the repositories it reaches", async () => {
    docker.script(({ argv }) => {
      if (argv.includes(".login")) return { stdout: "octocat\n" };
      if (argv.includes(".[].full_name")) return { stdout: "acme/web\nacme/api\n" };
      return undefined;
    });
    await link.deliver("pod.checkLogins", { podId: POD });
    expect(link.of("pod.logins")).toEqual([
      { podId: POD, claude: true, gh: true, ghAccount: "octocat", tokenRepos: ["acme/web", "acme/api"], checkedAt: expect.any(String) },
    ]);
    expect(docker.execs.every((e) => e.options.user === "pod" && e.container === CONTAINER)).toBe(true);
  });

  it("a logged-out gh reads as false with no account", async () => {
    docker.script(({ argv }) => (argv[0] === "gh" && argv[1] === "auth" ? { exitCode: 1 } : undefined));
    await link.deliver("pod.checkLogins", { podId: POD });
    expect(link.of("pod.logins")[0]).toMatchObject({ claude: true, gh: false, ghAccount: null, tokenRepos: [] });
  });
});

describe("workspace.prepare (T1-16, POD-10, RUN-3)", () => {
  const prepare = (runId: string, branch: string) => ({ runId, podId: POD, owner: "acme", repo: "web", baseBranch: "main", branch });

  it("clones once with gh, then only fetches; each Run gets its worktree and branch", async () => {
    await link.deliver("workspace.prepare", prepare("run-1", "clauderon/1-a-run1"));
    await link.deliver("workspace.prepare", prepare("run-2", "clauderon/2-b-run2"));

    const commands = docker.commands();
    expect(commands.filter((c) => c.startsWith("gh repo clone"))).toEqual(["gh repo clone acme/web /workspace/projects/acme/web"]);
    expect(commands.filter((c) => c.includes(" fetch "))).toEqual(["git -C /workspace/projects/acme/web fetch origin main"]);
    expect(commands.filter((c) => c.includes("worktree add"))).toEqual([
      "git -C /workspace/projects/acme/web worktree add /workspace/runs/run-1 -b clauderon/1-a-run1 origin/main",
      "git -C /workspace/projects/acme/web worktree add /workspace/runs/run-2 -b clauderon/2-b-run2 origin/main",
    ]);
    expect(link.of("workspace.ready")).toEqual([
      { runId: "run-1", worktreePath: "/workspace/runs/run-1" },
      { runId: "run-2", worktreePath: "/workspace/runs/run-2" },
    ]);
  });

  it("reports workspace.failed with the masked error", async () => {
    docker.script(({ argv }) => (argv.includes("clone") ? { exitCode: 1, stderr: "auth failed for ghp_abcdefghijklmnopqrstuvwxyz0123" } : undefined));
    await link.deliver("workspace.prepare", prepare("run-1", "clauderon/1-a-run1"));
    expect(link.of("workspace.failed")).toEqual([{ runId: "run-1", error: expect.stringContaining("•••") }]);
    expect(JSON.stringify(link.sent)).not.toContain("ghp_");
  });

  it("refuses unsafe names", async () => {
    await link.deliver("workspace.prepare", { ...prepare("run-1", "x; rm -rf /"), branch: "x; rm -rf /" });
    expect(link.of("workspace.failed")).toHaveLength(1);
    expect(docker.execs).toHaveLength(0);
  });
});

/** Scripts git: HEAD moves when `commits` is set; the git dir is fixed. */
function scriptGit(heads: string[]) {
  docker.script(({ argv }) => {
    if (argv[0] !== "git") return undefined;
    if (argv.includes("--absolute-git-dir")) return { stdout: "/workspace/projects/acme/web/.git/worktrees/run-1\n" };
    if (argv.includes("HEAD")) return { stdout: `${heads.shift() ?? "same"}\n` };
    return undefined;
  });
}

const nodeRun = (extra: Partial<Payload<"node.run">> & Pick<Payload<"node.run">, "kind">): Payload<"node.run"> => ({
  attemptId: "att-1",
  runId: "run-1",
  podId: POD,
  worktreePath: "/workspace/runs/run-1",
  env: {},
  ...extra,
});

describe("Command Nodes (RUN-10)", () => {
  it("exit 0 succeeds; test-result holds the last 200 lines; env inputs become files", async () => {
    scriptGit(["h1", "h1"]);
    const lines = Array.from({ length: 250 }, (_, i) => `line ${i}`).join("\n");
    docker.script(({ argv }) => (argv[0] === "bash" && argv[1] === "-lc" ? { stdout: `${lines}\n` } : undefined));
    await link.deliver("node.run", nodeRun({ kind: "command", command: "npm test", env: { CLAUDERON_BRANCH: "b", CLAUDERON_SUMMARY: "did it" } }));

    const [result] = link.of("node.result");
    expect(result).toMatchObject({ attemptId: "att-1", exitCode: 0, headCommit: "h1" });
    const tail = (result!.result as { tail: string }).tail.split("\n");
    expect(tail).toHaveLength(200);
    expect(tail[0]).toBe("line 50");
    expect(link.of("node.log").map((l) => l.seq)).toEqual(Array.from({ length: 250 }, (_, i) => i));

    const command = docker.execs.find((e) => e.argv[2] === "npm test")!;
    expect(command.options).toMatchObject({ user: "pod", workdir: "/workspace/runs/run-1" });
    expect(command.options.env).toEqual({
      CLAUDERON_BRANCH: "b",
      CLAUDERON_SUMMARY_FILE: "/workspace/projects/acme/web/.git/worktrees/run-1/clauderon-att-1-clauderon_summary",
    });
  });

  it("a non-zero exit fails with its code", async () => {
    scriptGit(["h1", "h1"]);
    docker.script(({ argv }) => (argv[2] === "false" ? { exitCode: 3 } : undefined));
    await link.deliver("node.run", nodeRun({ kind: "command", command: "false" }));
    expect(link.of("node.result")[0]).toMatchObject({ exitCode: 3, error: "Command exited 3" });
  });

  it("reads the pull request line printed by clauderon-open-pr", async () => {
    scriptGit(["h1", "h1"]);
    docker.script(({ argv }) =>
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
    docker.script(({ argv }) => (argv.join(" ") === "gh auth token" ? { stdout: "gho_ownertokenownertokenownertoken12\n" } : undefined));
    docker.script(({ argv }) =>
      argv[2] === "env"
        ? { stdout: "token ghp_abcdefghijklmnopqrstuvwxyz0123\nsecret host-secret-value\n", stderr: "plain stderr\n" }
        : undefined,
    );
    await link.deliver("node.run", nodeRun({ kind: "command", command: "env" }));
    const text = link.of("node.log").map((l) => l.text);
    expect(text).toEqual(["token •••", "secret •••", "plain stderr"]);
    expect(JSON.stringify(link.sent)).not.toMatch(/ghp_|host-secret-value|gho_/);
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
    docker.script(({ argv }) => (argv[2]?.startsWith("claude ") ? { stdout: `${stream}\n` } : undefined));
    await link.deliver("node.run", nodeRun({ kind: "agent", prompt: "Do the thing", env: { CLAUDERON_EXPECT_COMMIT: "1" } }));

    const write = docker.execs.find((e) => e.argv[4]?.includes("clauderon-prompt-att-1.md"))!;
    expect(write.options.env).toEqual({ CLAUDERON_CONTENT: "Do the thing" });
    const claude = docker.execs.find((e) => e.argv[2]?.startsWith("claude "))!;
    expect(claude.argv[2]).toBe('claude -p --output-format stream-json --verbose --dangerously-skip-permissions < "$CLAUDERON_PROMPT_FILE"');
    expect(claude.options.workdir).toBe("/workspace/runs/run-1");

    expect(link.of("node.usage")).toEqual([{ attemptId: "att-1", inputTokens: 15, outputTokens: 7 }]);
    expect(link.of("node.result")).toEqual([
      { attemptId: "att-1", exitCode: 0, result: { outputs: { summary: "Fixed totals" } }, sessionId: "sess-1", headCommit: "h2" },
    ]);
    expect(link.of("node.log").map((l) => l.text)).toContain("[tool] Edit {\"file\":\"a.ts\"}");
  });

  it("a branch Output needs a commit: HEAD that did not move fails with 'no commit on the branch'", async () => {
    scriptGit(["h1", "h1"]);
    docker.script(({ argv }) => (argv[2]?.startsWith("claude ") ? { stdout: `${stream}\n` } : undefined));
    await link.deliver("node.run", nodeRun({ kind: "agent", prompt: "p", env: { CLAUDERON_EXPECT_COMMIT: "1" } }));
    expect(link.of("node.result")[0]).toMatchObject({ error: "no commit on the branch" });
  });

  it("parses a line that is not JSON as a plain log line", () => {
    expect(parseClaudeLine("plain")).toEqual({ log: "plain" });
  });
});

describe("Terminals (POD-9)", () => {
  it("opens bash -l as pod under a TTY, relays input, output and resize, and reports closed", async () => {
    await link.deliver("terminal.open", { sessionId: "t1", podId: POD, cols: 100, rows: 30 });
    const tty = docker.ttys[0]!;
    expect(tty).toMatchObject({ container: CONTAINER, argv: ["bash", "-l"], size: [100, 30] });
    expect(tty.options.user).toBe("pod");

    await link.deliver("terminal.input", { sessionId: "t1", podId: POD, data: "gh auth login\r" });
    tty.print("Logged in");
    await link.deliver("terminal.resize", { sessionId: "t1", podId: POD, cols: 120, rows: 40 });
    await link.deliver("terminal.close", { sessionId: "t1", podId: POD });

    expect(tty.written).toEqual(["gh auth login\r"]);
    expect(tty.size).toEqual([120, 40]);
    expect(tty.closed).toBe(true);
    expect(link.of("terminal.output")).toEqual([{ sessionId: "t1", data: "Logged in" }]);
    expect(link.of("terminal.closed")).toEqual([{ sessionId: "t1", exitCode: 0 }]);
  });

  it("POD-5: a login session runs only the Host Agent's own login command, never a shell", async () => {
    await link.deliver("terminal.open", { sessionId: "g1", podId: POD, cols: 1000, rows: 40, login: "gh" });
    await link.deliver("terminal.open", { sessionId: "c1", podId: POD, cols: 1000, rows: 40, login: "claude" });
    const [gh, claude] = docker.ttys;
    expect(gh).toMatchObject({ argv: ["bash", "-lc", "timeout --foreground 900 gh auth login --web --hostname github.com --git-protocol https && gh auth setup-git"] });
    expect(gh!.options).toMatchObject({ user: "pod", env: { GH_BROWSER: "true", GH_PROMPT_DISABLED: "1" } });
    expect(claude).toMatchObject({ argv: ["bash", "-lc", "timeout --foreground 900 claude auth login"] });

    await link.deliver("terminal.input", { sessionId: "c1", podId: POD, data: "pasted-code\r" });
    expect(claude!.written).toEqual(["pasted-code\r"]);
  });

  it("answers terminal.close for a session it does not know", async () => {
    await link.deliver("terminal.close", { sessionId: "gone", podId: POD });
    expect(link.of("terminal.closed")).toEqual([{ sessionId: "gone" }]);
  });
});
