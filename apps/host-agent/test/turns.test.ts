import { describe, expect, it } from "vitest";
import { TurnRecorder, parseClaudeLine } from "../src/claude";

const usage = (over: Record<string, number> = {}) => ({ input_tokens: 3, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000, output_tokens: 20, ...over });
const line = (event: unknown) => JSON.stringify(event);
const use = (id: string, name: string, input: Record<string, unknown>) => ({ type: "tool_use", id, name, input });
const assistant = (id: string, content: unknown[], over: Record<string, number> = {}) => ({ type: "assistant", message: { id, usage: usage(over), content } });
const result = (id: string, content: unknown) => ({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content }] } });

function record(events: unknown[], worktree = "/home/ann/.clauderon/runs/run-1") {
  const recorder = new TurnRecorder((text) => text.replaceAll("ghp_SECRET", "***"), worktree);
  for (const e of events) recorder.event(parseClaudeLine(line(e)));
  return recorder.turns();
}

describe("TurnRecorder (#105)", () => {
  it("records one turn per assistant message with its token split and its tool calls", () => {
    const turns = record([
      assistant("m1", [use("t1", "Read", { file_path: "/home/ann/.clauderon/runs/run-1/src/a.ts" })]),
      result("t1", "x".repeat(400)),
      assistant("m2", [{ type: "text", text: "Done" }], { output_tokens: 5 }),
    ]);
    expect(turns).toEqual([
      { index: 0, calls: [{ tool: "Read", target: "src/a.ts", resultBytes: 400 }], newInput: 3, cacheCreated: 100, cacheRead: 1000, output: 20 },
      { index: 1, calls: [], newInput: 3, cacheCreated: 100, cacheRead: 1000, output: 5 },
    ]);
  });

  it("keeps parallel tool calls of one message as separate calls, each with its own result size", () => {
    const turns = record([
      assistant("m1", [use("t1", "Read", { file_path: "a.ts" }), use("t2", "Read", { file_path: "b.ts" }), use("t3", "Grep", { pattern: "foo" })]),
      {
        type: "user",
        message: {
          content: [
            { type: "tool_result", tool_use_id: "t1", content: "a".repeat(10) },
            { type: "tool_result", tool_use_id: "t2", content: "b".repeat(20) },
            { type: "tool_result", tool_use_id: "t3", content: "c".repeat(30) },
          ],
        },
      },
    ]);
    expect(turns).toHaveLength(1);
    expect(turns[0]!.calls).toEqual([
      { tool: "Read", target: "a.ts", resultBytes: 10 },
      { tool: "Read", target: "b.ts", resultBytes: 20 },
      { tool: "Grep", target: "foo", resultBytes: 30 },
    ]);
  });

  it("merges the events of one API message into one turn, keeps the latest usage and does not repeat a call", () => {
    const turns = record([
      assistant("m1", [{ type: "text", text: "Let me look" }], { output_tokens: 2 }),
      assistant("m1", [use("t1", "Bash", { command: "pnpm test" })], { output_tokens: 30 }),
      assistant("m1", [use("t1", "Bash", { command: "pnpm test" })], { output_tokens: 30 }),
    ]);
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({ calls: [{ tool: "Bash", target: "pnpm test" }], output: 30 });
    expect(turns[0]!.calls).toHaveLength(1);
  });

  it("sums the sizes of a result given as text parts, and never keeps the content", () => {
    const turns = record([assistant("m1", [use("t1", "Grep", { pattern: "foo" })]), result("t1", [{ type: "text", text: "abc" }, { type: "text", text: "defg" }])]);
    expect(turns[0]!.calls[0]!.resultBytes).toBe(7);
    expect(JSON.stringify(turns)).not.toContain("abcdefg");
  });

  it("keeps only a command's program and subcommand, so arguments with secrets are never recorded", () => {
    const turns = record([assistant("m1", [use("t1", "Bash", { command: "TOKEN=ghp_SECRET curl -H ghp_SECRET https://x.test" })])]);
    expect(turns[0]!.calls[0]!.target).toBe("curl");
  });

  it("drops a URL's credentials and query", () => {
    const turns = record([assistant("m1", [use("t1", "WebFetch", { url: "https://user:pw@docs.test/a/b?token=abc#frag" })])]);
    expect(turns[0]!.calls[0]!.target).toBe("https://docs.test/a/b");
  });

  it("masks secrets in a path and truncates a long one", () => {
    const turns = record([assistant("m1", [use("t1", "Read", { file_path: `/tmp/ghp_SECRET/${"x".repeat(300)}` })])]);
    expect(turns[0]!.calls[0]!.target).not.toContain("ghp_SECRET");
    expect(turns[0]!.calls[0]!.target!.length).toBeLessThanOrEqual(121);
  });

  it("makes a Windows worktree path relative too", () => {
    const turns = record([assistant("m1", [use("t1", "Edit", { file_path: "C:\\Users\\a\\.clauderon\\runs\\r1\\src\\b.ts" })])], "C:\\Users\\a\\.clauderon\\runs\\r1");
    expect(turns[0]!.calls[0]!.target).toBe("src/b.ts");
  });

  it("ignores events without an id or usage (older Claude Code)", () => {
    expect(record([{ type: "assistant", message: { content: [{ type: "text", text: "hi" }] } }])).toEqual([]);
  });
});
