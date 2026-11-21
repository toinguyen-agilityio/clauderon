import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { settle } from "@clauderon/testing";
import { registerDraftHandlers } from "../src/drafts";
import { FakeLink, FakeSystem, gate } from "./fakes";

const HOME = "/home/ann/.clauderon";
const DRAFT = "11111111-2222-4333-8444-555555555555";
const DIR = join(HOME, "drafts", DRAFT);

let system: FakeSystem;
let link: FakeLink;

beforeEach(() => {
  system = new FakeSystem();
  link = new FakeLink();
  registerDraftHandlers(link, system, { log: () => {}, knownSecrets: ["machine-token-value"], home: HOME });
});

const stream = (result: string) =>
  [
    { type: "system", subtype: "init", session_id: "sess-1" },
    { type: "result", subtype: "success", session_id: "sess-1", result },
  ]
    .map((e) => JSON.stringify(e))
    .join("\n") + "\n";

const isClaude = (argv: string[]) => argv[2]?.startsWith("claude ") ?? false;

describe("flow.draft (ADR 0008)", () => {
  it("runs Claude Code in the draft's own directory without skipping permissions and reports its final message", async () => {
    system.script(({ argv }) => (isClaude(argv) ? { stdout: stream('```json\n{"name":"x"}\n``` machine-token-value') } : undefined));
    await link.deliver("flow.draft", { draftId: DRAFT, jobId: "job-1", prompt: "Design a Flow" });

    const claude = system.execs.find((e) => isClaude(e.argv))!;
    expect(claude.argv[2]).toBe('claude -p --output-format stream-json --verbose < "$CLAUDERON_PROMPT_FILE"');
    expect(claude.options.cwd).toBe(DIR);
    expect(claude.options.env).toEqual({ CLAUDERON_PROMPT_FILE: join(DIR, ".prompt.md") });
    // The prompt file is gone afterwards.
    expect(system.files.has(join(DIR, ".prompt.md"))).toBe(false);
    expect(link.of("flow.drafted")).toEqual([{ jobId: "job-1", exitCode: 0, finalText: '```json\n{"name":"x"}\n``` •••', sessionId: "sess-1" }]);
  });

  it("resumes the session it is given, and says when Claude Code no longer has it", async () => {
    system.script(({ argv }) => (isClaude(argv) ? { exitCode: 1, stderr: "No conversation found with session ID: sess-1\n" } : undefined));
    await link.deliver("flow.draft", { draftId: DRAFT, jobId: "job-2", prompt: "Add tests", resumeSessionId: "sess-1" });

    expect(system.execs.find((e) => isClaude(e.argv))!.argv[2]).toContain("--resume 'sess-1'");
    expect(link.of("flow.drafted")).toEqual([{ jobId: "job-2", exitCode: 1, error: expect.stringContaining("Claude Code exited 1"), unknownSession: true }]);
  });

  it("flow.draftKill signals the running call; an unknown job is a no-op", async () => {
    const held = gate();
    system.script(({ argv }) => (isClaude(argv) ? { until: held.promise } : undefined));
    await link.deliver("flow.draft", { draftId: DRAFT, jobId: "job-3", prompt: "Design a Flow" });
    await link.deliver("flow.draftKill", { jobId: "other" });
    await link.deliver("flow.draftKill", { jobId: "job-3" });

    const claude = system.execs.find((e) => isClaude(e.argv))!;
    expect(system.kills).toEqual([{ pid: claude.pid, signal: "TERM" }]);
    held.open();
    await settle();
  });
});
