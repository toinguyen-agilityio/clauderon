import { beforeEach, describe, expect, it } from "vitest";
import type { Payload } from "@clauderon/protocol";
import { settle } from "@clauderon/testing";
import { registerNodeHandlers, type NodeHandles } from "../src/nodes";
import { FakeLink, FakeSystem, gate } from "./fakes";

// Agent side of M3 (spec M3 §2.2, §4, §6).

let system: FakeSystem;
let link: FakeLink;
let nodes: NodeHandles;
const HOME = "/home/ann/.clauderon";
const GIT_DIR = "/home/ann/.clauderon/projects/acme/web/.git/worktrees/run-1";

beforeEach(() => {
  system = new FakeSystem();
  link = new FakeLink();
  nodes = registerNodeHandlers(link, system, { log: () => {}, knownSecrets: [], home: HOME, killGraceMs: 0 });
  system.script(({ argv }) => {
    if (argv[0] !== "git") return undefined;
    if (argv.includes("--absolute-git-dir")) return { stdout: `${GIT_DIR}\n` };
    if (argv.includes("HEAD")) return { stdout: "h1\n" };
    return undefined;
  });
});

const nodeRun = (extra: Partial<Payload<"node.run">> & Pick<Payload<"node.run">, "kind">): Payload<"node.run"> => ({
  attemptId: "att-1",
  runId: "run-1",
  worktreePath: "/home/ann/.clauderon/runs/run-1",
  env: {},
  ...extra,
});

const claudeStream = (text: string) =>
  [
    { type: "system", subtype: "init", session_id: "sess-1" },
    { type: "result", subtype: "success", session_id: "sess-1", result: text },
  ]
    .map((e) => JSON.stringify(e))
    .join("\n") + "\n";

describe("Grill rounds on the Agent (spec M3 §2.2)", () => {
  it("resumes the session with --resume and keeps log line numbers going across rounds", async () => {
    system.script(({ argv }) => (argv[2]?.startsWith("claude ") ? { stdout: claudeStream('```json\n{"questions": [{"id": "q1", "text": "Why?"}]}\n```') } : undefined));
    await link.deliver("node.run", nodeRun({ kind: "agent", prompt: "Grill it" }));
    await link.deliver("node.run", nodeRun({ kind: "agent", prompt: "Answers", resumeSessionId: "sess-1" }));

    const claude = system.execs.filter((e) => e.argv[2]?.startsWith("claude "));
    expect(claude[1]!.argv[2]).toContain("--resume 'sess-1'");
    const seqs = link.of("node.log").map((l) => l.seq);
    expect(new Set(seqs).size).toBe(seqs.length);
    expect(link.of("node.result")[0]).toMatchObject({ result: { questions: [{ id: "q1", text: "Why?" }] }, sessionId: "sess-1" });
  });

  it("an unknown session fails the Attempt with that reason", async () => {
    system.script(({ argv }) =>
      argv[2]?.startsWith("claude ") ? { exitCode: 1, stderr: "No conversation found with session ID: sess-gone\n" } : undefined,
    );
    await link.deliver("node.run", nodeRun({ kind: "agent", prompt: "Answers", resumeSessionId: "sess-gone" }));
    expect(link.of("node.result")[0]!.error).toBe("Claude session sess-gone could not be resumed: No conversation found with session ID: sess-gone");
  });
});

describe("A resumed session's own output (spec M3 §2.2)", () => {
  it("is never read as an unknown-session error", async () => {
    // The plan mentions a 404 ("not found") and the stream-json line names the session.
    system.script(({ argv }) => (argv[2]?.startsWith("claude ") ? { stdout: claudeStream("The plan: GET /api/foods/999 is not found.") } : undefined));
    await link.deliver("node.run", nodeRun({ kind: "agent", prompt: "Answers", resumeSessionId: "sess-1" }));
    expect(link.of("node.result")[0]!.error).toBeUndefined();
  });
});

describe("Retry context file (spec M3 §4)", () => {
  it("a Command Node gets CLAUDERON_RETRY_CONTEXT_FILE inside the git dir", async () => {
    await link.deliver("node.run", nodeRun({ kind: "command", command: "make test", env: { CLAUDERON_RETRY_CONTEXT: "## Feedback from the last review\n\nUse X" } }));
    expect(system.files.get(`${GIT_DIR}/clauderon-att-1-clauderon_retry_context`)).toBe("## Feedback from the last review\n\nUse X");
    const command = system.execs.find((e) => e.argv[2] === "make test")!;
    expect(command.options.env).toMatchObject({ CLAUDERON_RETRY_CONTEXT_FILE: `${GIT_DIR}/clauderon-att-1-clauderon_retry_context` });
    expect(command.options.env).not.toHaveProperty("CLAUDERON_RETRY_CONTEXT");
  });
});

describe("Orphans (spec M3 §6)", () => {
  const pidFile = (attemptId: string) => `${HOME}/nodes/${attemptId}.json`;
  const record = (pid: number, bootAt = system.boot) => JSON.stringify({ pid, bootAt: bootAt.toISOString() });

  it("records each running Node's process group, and forgets it once the Node ends", async () => {
    const held = gate();
    system.script(({ argv }) => (argv[2] === "sleep 100" ? { until: held.promise } : undefined));
    await link.deliver("node.run", nodeRun({ kind: "command", command: "sleep 100", attemptId: "att-live" }));
    const sleep = system.execs.find((e) => e.argv[2] === "sleep 100")!;
    expect(JSON.parse(system.files.get(pidFile("att-live"))!)).toEqual({ pid: sleep.pid, bootAt: system.boot.toISOString() });
    expect(nodes.running()).toEqual(["att-live"]);

    held.open();
    await settle();
    await settle();
    expect(nodes.running()).toEqual([]);
    expect(system.files.has(pidFile("att-live"))).toBe(false);
  });

  it("kills the process groups an earlier Agent process left, keeps its own live Nodes and skips pids of an earlier boot", async () => {
    const held = gate();
    system.script(({ argv }) => (argv[2] === "sleep 100" ? { until: held.promise } : undefined));
    await link.deliver("node.run", nodeRun({ kind: "command", command: "sleep 100", attemptId: "att-live" }));
    await system.writeFile(pidFile("att-orphan"), record(4242));
    await system.writeFile(pidFile("att-old-boot"), record(4343, new Date("2026-11-01T00:00:00Z")));

    await nodes.killOrphans();
    expect(system.kills).toEqual([{ pid: 4242, signal: "TERM" }]);
    expect([...system.files.keys()].filter((p) => p.startsWith(`${HOME}/nodes/`))).toEqual([pidFile("att-live")]);
    held.open();
  });

  it("a Node arriving during a sweep starts after it", async () => {
    await system.writeFile(pidFile("att-orphan"), record(4242));
    const sweep = nodes.killOrphans();
    await link.deliver("node.run", nodeRun({ kind: "command", command: "true", attemptId: "att-new" }));
    await sweep;
    await settle();
    expect(system.kills[0]).toEqual({ pid: 4242, signal: "TERM" });
    expect(system.files.has(pidFile("att-new"))).toBe(false);
    expect(system.execs.some((e) => e.argv[2] === "true")).toBe(true);
  });
});
