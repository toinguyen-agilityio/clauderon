import { describe, expect, it } from "vitest";
import type { Turn } from "@clauderon/core";
import { inspectorOf } from "../src/server/runs";

const turn = (index: number, over: Partial<Turn> = {}): Turn => ({ index, tool: null, target: null, resultBytes: null, newInput: 5, cacheCreated: 50, cacheRead: 500, output: 10, ...over });
const base = { inputTokens: 1100, outputTokens: 20, cacheCreationTokens: 100, cacheReadTokens: 1000 };

describe("Node inspector view (#105)", () => {
  it("builds the summary, turn details, findings and suggestions from the turns", () => {
    const turns = [turn(0, { tool: "Bash", target: "pnpm test", resultBytes: 40_000 }), turn(1, { tool: "Read", target: "a.ts", resultBytes: 100 }), turn(2)];
    const view = inspectorOf({ ...base, turns }, []);
    expect(view.hasTurns).toBe(true);
    expect(view.summary).toMatchObject({ turns: 3, toolCalls: 2, cacheRead: 1500, fresh: 165 });
    expect(view.turns[0]).toMatchObject({ context: 555, rereads: 2 });
    expect(view.findings.map((f) => f.kind)).toEqual(["large-result"]);
    expect(view.suggestions).toHaveLength(1);
  });

  it("shows totals only for an Attempt from an older Agent", () => {
    const view = inspectorOf({ inputTokens: 900, outputTokens: 10, cacheCreationTokens: null, cacheReadTokens: null, turns: null }, []);
    expect(view.hasTurns).toBe(false);
    expect(view.totalsOnly).toEqual({ input: 900, output: 10, cacheCreated: null, cacheRead: null });
    expect(view.findings).toEqual([]);
  });

  it("has no totals while an Attempt has not reported any", () => {
    const view = inspectorOf({ inputTokens: null, outputTokens: null, cacheCreationTokens: null, cacheReadTokens: null, turns: null }, []);
    expect(view.totalsOnly).toBeNull();
  });
});
