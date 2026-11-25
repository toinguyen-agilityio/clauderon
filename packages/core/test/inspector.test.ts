import { describe, expect, it } from "vitest";
import { contextSize, findWaste, historyEntry, rereads, resultBytesOf, scrubTarget, splitTokens, suggest, summarizeTurns, type Call, type Turn } from "../src";

const call = (tool: string, target: string | null = null, resultBytes: number | null = null): Call => ({ tool, target, resultBytes });
const turn = (index: number, calls: Call[] = [], over: Partial<Turn> = {}): Turn => ({
  index,
  calls,
  newInput: 10,
  cacheCreated: 100,
  cacheRead: 1000,
  output: 50,
  ...over,
});

describe("token split", () => {
  it("keeps new input, cache created and cache read apart", () => {
    const s = splitTokens([turn(0), turn(1)]);
    expect(s).toEqual({ total: 2320, fresh: 220, cacheRead: 2000, cacheCreated: 200, newInput: 20, output: 100 });
  });

  it("counts turns and tool calls separately, parallel calls included", () => {
    const s = summarizeTurns([turn(0, [call("Read", "a.ts"), call("Read", "b.ts"), call("Read", "c.ts")]), turn(1), turn(2, [call("Bash", "pnpm test")])]);
    expect(s).toMatchObject({ turns: 3, toolCalls: 4 });
  });

  it("gives the context a turn started with, and how many later turns re-read its results", () => {
    const turns = [turn(0, [call("Read", "a.ts", 400), call("Read", "b.ts", 600)]), turn(1), turn(2)];
    expect(contextSize(turns[0]!)).toBe(1110);
    expect(resultBytesOf(turns[0]!)).toBe(1000);
    expect(resultBytesOf(turns[1]!)).toBeNull();
    expect(rereads(turns, turns[0]!)).toBe(2);
    expect(rereads(turns, turns[2]!)).toBe(0);
  });
});

describe("waste rules", () => {
  it("flags the same file read more than once, costing the later reads", () => {
    const turns = [turn(0, [call("Read", "a.ts", 4000)]), turn(1, [call("Read", "b.ts", 400)]), turn(2, [call("Read", "a.ts", 4000)])];
    const found = findWaste(turns);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ kind: "repeated-read", turns: [0, 2], tokens: 1000 });
  });

  it("sees a file read twice among parallel calls of one message and across messages", () => {
    const turns = [turn(0, [call("Read", "a.ts", 400), call("Read", "b.ts", 400), call("Read", "c.ts", 400)]), turn(1, [call("Read", "b.ts", 400), call("Read", "c.ts", 400)])];
    const found = findWaste(turns);
    expect(found.map((f) => f.title).sort()).toEqual(["b.ts was read 2 times", "c.ts was read 2 times"]);
    expect(found.every((f) => f.turns.join() === "0,1")).toBe(true);
  });

  it("flags a very large tool result and ignores small ones", () => {
    const turns = [turn(0, [call("Bash", "pnpm test", 40_000)]), turn(1, [call("Read", "a.ts", 100)]), turn(2)];
    const found = findWaste(turns);
    expect(found.map((f) => f.kind)).toEqual(["large-result"]);
    expect(found[0]!.tokens).toBe(10_000 * 3);
  });

  it("flags many exploring calls before the first edit, not after it", () => {
    const explore = Array.from({ length: 4 }, (_, i) => turn(i, [call("Read", `f${i}`), call("Grep", `g${i}`)]));
    expect(findWaste([...explore, turn(4, [call("Edit", "f1")])]).map((f) => f.kind)).toEqual(["slow-start"]);
    expect(findWaste([turn(0, [call("Edit", "f1")]), ...explore.map((t) => ({ ...t, index: t.index + 1 }))])).toEqual([]);
    expect(findWaste(explore)).toEqual([]);
  });

  it("finds nothing in a tidy session and ranks findings by tokens", () => {
    expect(findWaste([turn(0, [call("Read", "a.ts", 100)]), turn(1, [call("Edit", "a.ts")])])).toEqual([]);
    const turns = [turn(0, [call("Bash", "pnpm test", 80_000)]), turn(1, [call("Read", "a.ts", 400)]), turn(2, [call("Read", "a.ts", 400)])];
    expect(findWaste(turns).map((f) => f.kind)).toEqual(["large-result", "repeated-read"]);
  });
});

describe("suggestions and history", () => {
  it("turns each finding into wording with a target and its turns", () => {
    const turns = [turn(0, [call("Bash", "pnpm test", 40_000)]), turn(1)];
    const [s] = suggest(findWaste(turns));
    expect(s).toMatchObject({ target: "project", turns: [0] });
    expect(s!.text).toContain("tail");
  });

  it("totals an attempt for the history row", () => {
    const at = new Date("2026-01-01T00:00:00Z");
    expect(historyEntry({ runId: "r1", at, turns: [turn(0), turn(1)] })).toEqual({ runId: "r1", at, turns: 2, fresh: 220, total: 2320 });
  });
});

describe("scrubTarget", () => {
  it("keeps a command's program and a plain subcommand, nothing else", () => {
    expect(scrubTarget("Bash", "pnpm test --filter x")).toBe("pnpm test");
    expect(scrubTarget("Bash", "git diff HEAD~1")).toBe("git diff");
    expect(scrubTarget("Bash", "ls")).toBe("ls");
  });

  it("skips leading VAR=value assignments and never keeps an option, URL or value as the second word", () => {
    expect(scrubTarget("Bash", "TOKEN=abc123 API_KEY=x curl https://user:pw@h.test")).toBe("curl");
    expect(scrubTarget("Bash", "curl -H 'Authorization: Bearer abc'")).toBe("curl");
    expect(scrubTarget("Bash", "curl https://user:pw@h.test/a")).toBe("curl");
    expect(scrubTarget("Bash", "TOKEN=abc")).toBe("");
  });

  it("drops credentials, query and fragment from a URL of any scheme", () => {
    expect(scrubTarget("WebFetch", "https://user:pw@docs.test/a/b?token=abc#frag")).toBe("https://docs.test/a/b");
    expect(scrubTarget("WebFetch", "ftp://user:pw@files.test/x?y=1")).toBe("ftp://files.test/x");
    expect(scrubTarget("WebFetch", "postgres://u:p@db.test:5432/app")).not.toContain("p@");
  });

  it("leaves a path alone and is safe to apply twice", () => {
    expect(scrubTarget("Read", "src/a.ts")).toBe("src/a.ts");
    const once = scrubTarget("Bash", "FOO=1 pnpm test");
    expect(scrubTarget("Bash", once)).toBe(once);
  });
});
