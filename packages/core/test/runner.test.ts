import { describe, expect, it } from "vitest";
import {
  CONTEXT_WRITING,
  MASK,
  RETRY_RESUME_MAX_CONTEXT,
  RETRY_RESUME_WINDOW_MS,
  buildRetryResumePrompt,
  resumableSession,
  branchName,
  buildAgentPrompt,
  REPO_GUIDANCE,
  checkAgentResult,
  commandOutputs,
  extractResultBlock,
  isMachineReady,
  ticketKeys,
  tailLines,
} from "../src/index";

describe("branchName (RUN-3)", () => {
  it("T1-14: issue 412 'Fix: Ledger totals!' gives clauderon/412-fix-ledger-totals-<6>", () => {
    expect(branchName(412, "Fix: Ledger totals!", "a1b2c3d4-0000-0000-0000-000000000000")).toBe("clauderon/412-fix-ledger-totals-a1b2c3");
  });

  it("keeps the slug to 40 characters of [a-z0-9-] without trailing dashes", () => {
    const name = branchName(7, "Ünïcode — and a very, very long title that keeps going on and on", "ffffff00");
    const slug = name.slice("clauderon/7-".length, -"-ffffff".length);
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("falls back to 'ticket' when the title has no usable characters", () => {
    expect(branchName(3, "!!!", "abcdef12")).toBe("clauderon/3-ticket-abcdef");
  });
});

describe("ticketKeys (TIC-1)", () => {
  it("T1-8: two Projects with the same repository name show owner/repo#n", () => {
    const keys = ticketKeys([
      { id: "p1", owner: "acme", repo: "web" },
      { id: "p2", owner: "other", repo: "web" },
      { id: "p3", owner: "acme", repo: "api" },
    ]);
    expect(keys("p1", 4)).toBe("acme/web#4");
    expect(keys("p2", 4)).toBe("other/web#4");
    expect(keys("p3", 9)).toBe("api#9");
  });
});

describe("isMachineReady (POD-5)", () => {
  it("needs a connected Machine with both logins", () => {
    expect(isMachineReady({ connected: true, claudeLoggedIn: true, ghLoggedIn: true })).toBe(true);
    expect(isMachineReady({ connected: false, claudeLoggedIn: true, ghLoggedIn: true })).toBe(false);
    expect(isMachineReady({ connected: true, claudeLoggedIn: true, ghLoggedIn: false })).toBe(false);
  });

  it("ADR 0007: a failed doctor check blocks it, a warning or a Gateway check does not", () => {
    const ready = { connected: true, claudeLoggedIn: true, ghLoggedIn: true };
    expect(isMachineReady({ ...ready, doctor: { checks: [{ id: "tool.git", status: "fail" }] } })).toBe(false);
    expect(isMachineReady({ ...ready, doctor: { checks: [{ id: "disk", status: "warn" }] } })).toBe(true);
    // The live connection says whether the Gateway is reachable, not an older report.
    expect(isMachineReady({ ...ready, doctor: { checks: [{ id: "gateway.reachable", status: "fail" }] } })).toBe(true);
    expect(isMachineReady({ ...ready, doctor: null })).toBe(true);
  });
});

describe("buildAgentPrompt (RUN-10)", () => {
  it("puts instructions, extra instructions, inputs and the result contract in order", () => {
    const prompt = buildAgentPrompt({
      instructions: "Make the change.",
      placementInstructions: "Keep it small.",
      batchInstructions: "Use British spelling.",
      inputs: [
        { name: "issue", value: { number: 4, title: "Fix totals", body: "They are off.", labels: ["bug"], url: "u" } },
        { name: "plan", value: "1. Do it" },
      ],
      outputs: ["branch", "summary"],
    });
    const order = ["Make the change.", "Keep it small.", "Use British spelling.", "## Repository guidance", "## issue", "Fix totals", "## plan", "1. Do it", '"outputs"'];
    const positions = order.map((part) => prompt.indexOf(part));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(prompt).toContain('"summary"');
    expect(prompt).toMatch(/commit your work/i);
  });

  it("tells every Node to read the repository's own guidance without naming a folder layout", () => {
    for (const grill of [false, true]) {
      const prompt = buildAgentPrompt({ instructions: "Plan.", placementInstructions: "", batchInstructions: "", inputs: [], outputs: ["plan"], grill });
      expect(prompt).toContain(REPO_GUIDANCE);
    }
    for (const file of ["AGENTS.md", "CLAUDE.md", "GEMINI.md", ".github/copilot-instructions.md", "CONTRIBUTING.md", "README.md"]) expect(REPO_GUIDANCE).toContain(file);
    expect(REPO_GUIDANCE).not.toMatch(/docs\/(adr|specs)/);
    expect(REPO_GUIDANCE).toMatch(/If none exist, carry on/);
  });

  it("leaves out empty extra instructions", () => {
    const prompt = buildAgentPrompt({ instructions: "Plan.", placementInstructions: "", batchInstructions: " ", inputs: [], outputs: ["plan"] });
    expect(prompt.startsWith("Plan.\n\n")).toBe(true);
    expect(prompt).not.toContain("Extra instructions");
  });
});

describe("extractResultBlock (M0 §6)", () => {
  it("takes the last fenced JSON block", () => {
    const text = 'Here:\n```json\n{"outputs": {"plan": "old"}}\n```\nthen\n```json\n{"outputs": {"plan": "new"}}\n```\n';
    expect(extractResultBlock(text)).toEqual({ outputs: { plan: "new" } });
  });

  it("keeps Output text that holds its own code fences", () => {
    const plan = "## Verification\n\n```bash\nnpm test\n```\n\nDone.";
    const text = `Plan ready.\n\n\`\`\`json\n${JSON.stringify({ outputs: { plan } })}\n\`\`\`\n`;
    expect(extractResultBlock(text)).toEqual({ outputs: { plan } });
  });

  it("returns null when there is no block or it is not JSON", () => {
    expect(extractResultBlock("no block")).toBeNull();
    expect(extractResultBlock("```json\n{oops\n```")).toBeNull();
  });
});

describe("checkAgentResult (RUN-10)", () => {
  const node = { kind: "agent" as const, outputs: [{ name: "branch", type: "branch" as const, optional: false }, { name: "summary", type: "summary" as const, optional: true }] };

  it("T1-12: a missing required Output fails with that reason", () => {
    expect(checkAgentResult(node, ["summary"], { outputs: { summary: "done" } })).toEqual({ ok: false, reason: "Required Output branch is missing" });
  });

  it("accepts the Outputs it was given; branch comes from the Host Agent", () => {
    expect(checkAgentResult(node, ["summary"], { outputs: { summary: "done" } }, { branch: "b", headCommit: "abc" })).toEqual({
      ok: true,
      outputs: [
        { name: "branch", type: "branch", value: { branch: "b", headCommit: "abc" } },
        { name: "summary", type: "summary", value: "done" },
      ],
    });
  });

  it("refuses unknown Outputs, questions from a non-Grill Node and no result", () => {
    expect(checkAgentResult(node, ["summary"], { outputs: { summary: "x", extra: 1 } }, { branch: "b", headCommit: "c" })).toEqual({
      ok: false,
      reason: "Unknown Output extra",
    });
    expect(checkAgentResult(node, [], { questions: [{ id: "q1", text: "?" }] })).toEqual({ ok: false, reason: "Only a Grill Node can ask questions" });
    expect(checkAgentResult(node, [], undefined)).toEqual({ ok: false, reason: "The agent did not end with a result block" });
  });

  it("drops an optional Output that is turned off", () => {
    expect(checkAgentResult(node, [], { outputs: { summary: "x" } }, { branch: "b", headCommit: "c" })).toEqual({
      ok: true,
      outputs: [{ name: "branch", type: "branch", value: { branch: "b", headCommit: "c" } }],
    });
  });
});

describe("commandOutputs (RUN-10, RUN-11)", () => {
  const outputs = [
    { name: "test-result", type: "test-result" as const, optional: false },
    { name: "branch", type: "branch" as const, optional: false },
    { name: "pull-request", type: "pull-request" as const, optional: true },
  ];

  it("builds test-result, branch and pull-request", () => {
    expect(
      commandOutputs(outputs, ["pull-request"], { exitCode: 0, tail: "ok", pullRequest: { number: 5, url: "u" } }, { branch: "b", headCommit: "h" }),
    ).toEqual([
      { name: "test-result", type: "test-result", value: { exitCode: 0, tail: "ok" } },
      { name: "branch", type: "branch", value: { branch: "b", headCommit: "h" } },
      { name: "pull-request", type: "pull-request", value: { number: 5, url: "u" } },
    ]);
  });

  it("leaves out pull-request when the script printed none (T1-13)", () => {
    expect(commandOutputs([outputs[2]!], ["pull-request"], { exitCode: 0, tail: "no changes" }, { branch: "b", headCommit: null })).toEqual([]);
  });
});

describe("tailLines", () => {
  it("keeps the last n lines", () => {
    expect(tailLines("a\nb\nc\n", 2)).toBe("b\nc");
    expect(MASK).toBe("•••");
  });
});

describe("retry resume and context (#218)", () => {
  const now = new Date("2026-01-01T00:10:00Z");
  const turn = (context: number) => ({ index: 0, calls: [], newInput: 0, cacheCreated: 0, cacheRead: context, output: 1 });
  const failed = { state: "failed", claudeSessionId: "s1", endedAt: new Date("2026-01-01T00:08:00Z"), turns: [turn(1_000), turn(40_000)] };

  it("resumes a small session that failed minutes ago", () => {
    expect(resumableSession(failed, now)).toBe("s1");
    expect(resumableSession({ ...failed, state: "interrupted" }, now)).toBe("s1");
  });

  it("starts fresh when the cache is cold, the context large, or nothing to resume", () => {
    expect(resumableSession({ ...failed, endedAt: new Date(now.getTime() - RETRY_RESUME_WINDOW_MS - 1) }, now)).toBeNull();
    expect(resumableSession({ ...failed, turns: [turn(RETRY_RESUME_MAX_CONTEXT)] }, now)).toBeNull();
    expect(resumableSession({ ...failed, state: "succeeded" }, now)).toBeNull();
    expect(resumableSession({ ...failed, claudeSessionId: null }, now)).toBeNull();
    expect(resumableSession({ ...failed, turns: null }, now)).toBeNull();
    expect(resumableSession(undefined, now)).toBeNull();
  });

  it("asks for the result again when resuming, and says what a context Output holds", () => {
    const prompt = buildRetryResumePrompt({ outputs: ["summary", "context"], contextOutputs: ["context"], retryContext: { feedback: null, failure: null, note: "Mind the cache.", retriedBy: "Ann" } });
    expect(prompt).toContain("Mind the cache.");
    expect(prompt).toContain("## Result");
    expect(prompt).toContain(`context: ${CONTEXT_WRITING}`);
    expect(buildAgentPrompt({ instructions: "Do it.", placementInstructions: "", batchInstructions: "", inputs: [], outputs: ["summary"] })).not.toContain(CONTEXT_WRITING);
  });
});
