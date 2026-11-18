import { beforeEach, describe, expect, it } from "vitest";
import type { Payload } from "@clauderon/protocol";
import { settle } from "@clauderon/testing";
import { podStatuses, registerNodeHandlers, type NodeHandles } from "../src/nodes";
import { FakeDocker, FakeLink } from "./fakes";

// Host Agent side of M3 (spec M3 §2.2, §4, §6).

let docker: FakeDocker;
let link: FakeLink;
let nodes: NodeHandles;

const POD = "11111111-2222-3333-4444-555555555555";
const CONTAINER = `clauderon-pod-${POD}`;

beforeEach(() => {
  docker = new FakeDocker();
  link = new FakeLink();
  nodes = registerNodeHandlers(link, docker, { log: () => {}, knownSecrets: [] });
  docker.script(({ argv }) => {
    if (argv[0] !== "git") return undefined;
    if (argv.includes("--absolute-git-dir")) return { stdout: "/workspace/projects/acme/web/.git/worktrees/run-1\n" };
    if (argv.includes("HEAD")) return { stdout: "h1\n" };
    return undefined;
  });
});

const nodeRun = (extra: Partial<Payload<"node.run">> & Pick<Payload<"node.run">, "kind">): Payload<"node.run"> => ({
  attemptId: "att-1",
  runId: "run-1",
  podId: POD,
  worktreePath: "/workspace/runs/run-1",
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

describe("Grill rounds on the Host Agent (spec M3 §2.2)", () => {
  it("resumes the session with --resume and keeps log line numbers going across rounds", async () => {
    docker.script(({ argv }) => (argv[2]?.startsWith("claude ") ? { stdout: claudeStream('```json\n{"questions": [{"id": "q1", "text": "Why?"}]}\n```') } : undefined));
    await link.deliver("node.run", nodeRun({ kind: "agent", prompt: "Grill it" }));
    await link.deliver("node.run", nodeRun({ kind: "agent", prompt: "Answers", resumeSessionId: "sess-1" }));

    const claude = docker.execs.filter((e) => e.argv[2]?.startsWith("claude "));
    expect(claude[1]!.argv[2]).toContain("--resume 'sess-1'");
    const seqs = link.of("node.log").map((l) => l.seq);
    expect(new Set(seqs).size).toBe(seqs.length);
    expect(link.of("node.result")[0]).toMatchObject({ result: { questions: [{ id: "q1", text: "Why?" }] }, sessionId: "sess-1" });
  });

  it("an unknown session fails the Attempt with that reason", async () => {
    docker.script(({ argv }) =>
      argv[2]?.startsWith("claude ") ? { exitCode: 1, stderr: "No conversation found with session ID: sess-gone\n" } : undefined,
    );
    await link.deliver("node.run", nodeRun({ kind: "agent", prompt: "Answers", resumeSessionId: "sess-gone" }));
    expect(link.of("node.result")[0]!.error).toBe("Claude session sess-gone could not be resumed: No conversation found with session ID: sess-gone");
  });
});

describe("A resumed session's own output (spec M3 §2.2)", () => {
  it("is never read as an unknown-session error", async () => {
    // The plan mentions a 404 ("not found") and the stream-json line names the session.
    docker.script(({ argv }) => (argv[2]?.startsWith("claude ") ? { stdout: claudeStream("The plan: GET /api/foods/999 is not found.") } : undefined));
    await link.deliver("node.run", nodeRun({ kind: "agent", prompt: "Answers", resumeSessionId: "sess-1" }));
    expect(link.of("node.result")[0]!.error).toBeUndefined();
  });
});

describe("Retry context file (spec M3 §4)", () => {
  it("a Command Node gets CLAUDERON_RETRY_CONTEXT_FILE inside the git dir", async () => {
    await link.deliver("node.run", nodeRun({ kind: "command", command: "make test", env: { CLAUDERON_RETRY_CONTEXT: "## Feedback from the last review\n\nUse X" } }));
    const write = docker.execs.find((e) => e.argv[4]?.endsWith("clauderon-att-1-clauderon_retry_context"))!;
    expect(write.options.env).toEqual({ CLAUDERON_CONTENT: "## Feedback from the last review\n\nUse X" });
    const command = docker.execs.find((e) => e.argv[2] === "make test")!;
    expect(command.options.env).toMatchObject({ CLAUDERON_RETRY_CONTEXT_FILE: "/workspace/projects/acme/web/.git/worktrees/run-1/clauderon-att-1-clauderon_retry_context" });
    expect(command.options.env).not.toHaveProperty("CLAUDERON_RETRY_CONTEXT");
  });
});

describe("Orphans and Pod states (spec M3 §6)", () => {
  it("kills, in every running Pod container, Node processes it holds no handle for, keeping its live Attempts", async () => {
    docker.containers.set(CONTAINER, { name: CONTAINER, image: "i", volume: "v", cpus: 1, memoryMb: 1, user: "pod", running: true });
    docker.containers.set("clauderon-pod-stopped", { name: "clauderon-pod-stopped", image: "i", volume: "v2", cpus: 1, memoryMb: 1, user: "pod", running: false });
    let release: (() => void) | undefined;
    const original = docker.exec.bind(docker);
    docker.exec = async (container, argv, options, onOutput) => {
      const code = await original(container, argv, options, onOutput);
      if (argv[2] === "sleep 100") await new Promise<void>((resolve) => (release = resolve));
      return code;
    };
    await link.deliver("node.run", nodeRun({ kind: "command", command: "sleep 100", attemptId: "att-live" }));
    expect(nodes.running()).toEqual(["att-live"]);

    await nodes.killOrphans();
    const sweeps = docker.execs.filter((e) => e.argv[0] === "bash" && e.argv[2]?.includes("orphans()"));
    expect(sweeps).toHaveLength(1);
    expect(sweeps[0]).toMatchObject({ container: CONTAINER, options: { user: "pod" } });
    expect(sweeps[0]!.argv.slice(3)).toEqual(["_", "att-live"]);
    release!();
    await settle();
    expect(nodes.running()).toEqual([]);
  });

  it("a Node arriving during a sweep starts after it", async () => {
    docker.containers.set(CONTAINER, { name: CONTAINER, image: "i", volume: "v", cpus: 1, memoryMb: 1, user: "pod", running: true });
    const sweep = nodes.killOrphans();
    await link.deliver("node.run", nodeRun({ kind: "command", command: "true", attemptId: "att-new" }));
    await sweep;
    await settle();
    const order = docker.execs.map((e) => (e.argv[2]?.includes("orphans()") ? "sweep" : e.argv[2] === "true" ? "node" : null)).filter(Boolean);
    expect(order).toEqual(["sweep", "node"]);
  });

  it("reports each Pod container as running or stopped", async () => {
    docker.containers.set(CONTAINER, { name: CONTAINER, image: "i", volume: "v", cpus: 1, memoryMb: 1, user: "pod", running: false });
    expect(await podStatuses(docker)).toEqual([{ podId: POD, status: "stopped" }]);
  });
});
