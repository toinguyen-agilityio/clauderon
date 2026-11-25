import { describe, expect, it } from "vitest";
import { TurnRecorder, parseClaudeLine } from "../src/claude";

const usage = (over: Record<string, number> = {}) => ({ input_tokens: 3, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000, output_tokens: 20, ...over });
const line = (event: unknown) => JSON.stringify(event);

function record(events: unknown[], worktree = "/home/ann/.clauderon/runs/run-1") {
  const recorder = new TurnRecorder((text) => text.replaceAll("ghp_SECRET", "***"), worktree);
  for (const e of events) recorder.event(parseClaudeLine(line(e)));
  return recorder.turns();
}

describe("TurnRecorder (#105)", () => {
  it("records one turn per assistant message with its token split, tool and target", () => {
    const turns = record([
      { type: "assistant", message: { id: "m1", usage: usage(), content: [{ type: "tool_use", id: "t1", name: "Read", input: { file_path: "/home/ann/.clauderon/runs/run-1/src/a.ts" } }] } },
      { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "x".repeat(400) }] } },
      { type: "assistant", message: { id: "m2", usage: usage({ output_tokens: 5 }), content: [{ type: "text", text: "Done" }] } },
    ]);
    expect(turns).toEqual([
      { index: 0, tool: "Read", target: "src/a.ts", resultBytes: 400, newInput: 3, cacheCreated: 100, cacheRead: 1000, output: 20 },
      { index: 1, tool: null, target: null, resultBytes: null, newInput: 3, cacheCreated: 100, cacheRead: 1000, output: 5 },
    ]);
  });

  it("merges the events of one API message into one turn and keeps the latest usage", () => {
    const turns = record([
      { type: "assistant", message: { id: "m1", usage: usage({ output_tokens: 2 }), content: [{ type: "text", text: "Let me look" }] } },
      { type: "assistant", message: { id: "m1", usage: usage({ output_tokens: 30 }), content: [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "pnpm test" } }] } },
    ]);
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({ tool: "Bash", target: "pnpm test", output: 30 });
  });

  it("sums the sizes of a result given as text parts, and never keeps the content", () => {
    const turns = record([
      { type: "assistant", message: { id: "m1", usage: usage(), content: [{ type: "tool_use", id: "t1", name: "Grep", input: { pattern: "foo" } }] } },
      { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1", content: [{ type: "text", text: "abc" }, { type: "text", text: "defg" }] }] } },
    ]);
    expect(turns[0]!.resultBytes).toBe(7);
    expect(JSON.stringify(turns)).not.toContain("abcdefg");
  });

  it("masks secrets in a target and truncates a long one", () => {
    const turns = record([
      { type: "assistant", message: { id: "m1", usage: usage(), content: [{ type: "tool_use", id: "t1", name: "Bash", input: { command: `curl -H ghp_SECRET ${"x".repeat(300)}` } }] } },
    ]);
    expect(turns[0]!.target).not.toContain("ghp_SECRET");
    expect(turns[0]!.target!.length).toBeLessThanOrEqual(121);
  });

  it("makes a Windows worktree path relative too", () => {
    const turns = record(
      [{ type: "assistant", message: { id: "m1", usage: usage(), content: [{ type: "tool_use", id: "t1", name: "Edit", input: { file_path: "C:\\Users\\a\\.clauderon\\runs\\r1\\src\\b.ts" } }] } }],
      "C:\\Users\\a\\.clauderon\\runs\\r1",
    );
    expect(turns[0]!.target).toBe("src/b.ts");
  });

  it("ignores events without an id or usage (older Claude Code)", () => {
    expect(record([{ type: "assistant", message: { content: [{ type: "text", text: "hi" }] } }])).toEqual([]);
  });
});
