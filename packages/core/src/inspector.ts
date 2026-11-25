// The Node inspector (#105): what an Agent Node did, turn by turn, and where its
// tokens went. Pure: the Agent sends a per-turn summary, never raw events.

/** One assistant turn of a `claude -p` session, summarised. Sizes only: no file contents or command output are kept. */
export type Turn = {
  index: number;
  /** The tool Claude called in this turn, when it called one (`Read`, `Bash`…). */
  tool: string | null;
  /** What the tool was aimed at (a path, a command, a pattern), masked and truncated. */
  target: string | null;
  /** Size in bytes of the tool's result, when the Agent saw it. */
  resultBytes: number | null;
  /** The token split of the turn's API call; cache read and cache created are never folded into input. */
  newInput: number;
  cacheCreated: number;
  cacheRead: number;
  output: number;
};

export const MAX_TARGET_LENGTH = 120;

/** Roughly four bytes to a token: enough to rank findings, not a bill. */
export const BYTES_PER_TOKEN = 4;
export const LARGE_RESULT_BYTES = 20_000;
export const EXPLORING_TURNS = 8;

const EXPLORING_TOOLS = new Set(["Read", "Grep", "Glob", "LS", "NotebookRead", "WebFetch", "WebSearch"]);
const EDITING_TOOLS = new Set(["Edit", "MultiEdit", "Write", "NotebookEdit"]);

export type TokenSplit = { total: number; fresh: number; cacheRead: number; cacheCreated: number; newInput: number; output: number };

export function splitTokens(turns: readonly Turn[]): TokenSplit {
  const sum = (pick: (t: Turn) => number) => turns.reduce((n, t) => n + pick(t), 0);
  const newInput = sum((t) => t.newInput);
  const cacheCreated = sum((t) => t.cacheCreated);
  const cacheRead = sum((t) => t.cacheRead);
  const output = sum((t) => t.output);
  return { total: newInput + cacheCreated + cacheRead + output, fresh: newInput + cacheCreated, cacheRead, cacheCreated, newInput, output };
}

/** The totals the Run page shows beside the turn list (AC: turns and tool calls). */
export function summarizeTurns(turns: readonly Turn[]): TokenSplit & { turns: number; toolCalls: number } {
  return { ...splitTokens(turns), turns: turns.length, toolCalls: turns.filter((t) => t.tool !== null).length };
}

/** The context Claude started a turn with. */
export const contextSize = (turn: Turn): number => turn.newInput + turn.cacheCreated + turn.cacheRead;

/** How many later turns carried this turn's tool result along in their context. */
export const rereads = (turns: readonly Turn[], turn: Turn): number => (turn.resultBytes === null ? 0 : Math.max(0, turns.length - turn.index - 1));

export type WasteKind = "repeated-read" | "large-result" | "slow-start";

export type Finding = {
  kind: WasteKind;
  /** One line a Member can read. */
  title: string;
  /** The turns to highlight. */
  turns: number[];
  /** Estimated tokens that stayed in context for nothing: a ranking figure, not an exact count. */
  tokens: number;
};

const tokensOf = (bytes: number) => Math.ceil(bytes / BYTES_PER_TOKEN);

/** Simple rules over the turns (AC): the same file read twice, a very large result, a long search before the first edit. */
export function findWaste(turns: readonly Turn[]): Finding[] {
  const findings: Finding[] = [];

  const reads = new Map<string, Turn[]>();
  for (const t of turns) {
    if (t.tool !== "Read" || !t.target) continue;
    reads.set(t.target, [...(reads.get(t.target) ?? []), t]);
  }
  for (const [target, again] of reads) {
    if (again.length < 2) continue;
    const extra = again.slice(1);
    const tokens = extra.reduce((n, t) => n + tokensOf(t.resultBytes ?? 0) * (rereads(turns, t) + 1), 0);
    findings.push({ kind: "repeated-read", title: `${target} was read ${again.length} times`, turns: again.map((t) => t.index), tokens });
  }

  for (const t of turns) {
    if (t.resultBytes === null || t.resultBytes < LARGE_RESULT_BYTES) continue;
    findings.push({
      kind: "large-result",
      title: `${t.tool ?? "A tool"}${t.target ? ` ${t.target}` : ""} returned ${Math.round(t.resultBytes / 1000)} KB`,
      turns: [t.index],
      tokens: tokensOf(t.resultBytes) * (rereads(turns, t) + 1),
    });
  }

  const firstEdit = turns.findIndex((t) => t.tool !== null && EDITING_TOOLS.has(t.tool));
  const before = firstEdit === -1 ? turns : turns.slice(0, firstEdit);
  const exploring = before.filter((t) => t.tool !== null && EXPLORING_TOOLS.has(t.tool));
  if (firstEdit !== -1 && exploring.length >= EXPLORING_TURNS) {
    findings.push({
      kind: "slow-start",
      title: `${exploring.length} exploring turns before the first edit`,
      turns: exploring.map((t) => t.index),
      tokens: exploring.reduce((n, t) => n + t.newInput + t.cacheCreated, 0),
    });
  }

  return findings.sort((a, b) => b.tokens - a.tokens);
}

export type SuggestionTarget = "node" | "project";

export type Suggestion = {
  /** Stable per kind and Node, so a Member's "added" mark survives a reload. */
  id: string;
  target: SuggestionTarget;
  /** The wording to add, ready to paste. */
  text: string;
  /** Estimated tokens this would have saved on this attempt. */
  tokens: number;
  turns: number[];
};

/** Suggested wording for each finding (AC); nothing is applied by itself. */
export function suggest(findings: readonly Finding[]): Suggestion[] {
  return findings.map((f) => {
    switch (f.kind) {
      case "repeated-read":
        return {
          id: `${f.kind}:${f.title}`,
          target: "node",
          text: `Read each file once and keep what you need from it. ${f.title.replace(/ was read.*/, "")} is relevant here, so note its key parts before moving on instead of reading it again.`,
          tokens: f.tokens,
          turns: f.turns,
        } satisfies Suggestion;
      case "large-result":
        return {
          id: `${f.kind}:${f.turns[0]}`,
          target: "project",
          text: "Keep command output short: pipe long output through `tail -n 40` or `grep`, and run one test file instead of the whole suite when you only need that one.",
          tokens: f.tokens,
          turns: f.turns,
        } satisfies Suggestion;
      case "slow-start":
        return {
          id: `${f.kind}`,
          target: "project",
          text: "Before searching the code, read `graphify-out/GRAPH_REPORT.md` and `docs/features.json`, then open only the files they point to.",
          tokens: f.tokens,
          turns: f.turns,
        } satisfies Suggestion;
    }
  });
}

export type NodeHistoryEntry = { runId: string; at: Date; turns: number; fresh: number; total: number };

/** A Node's earlier attempts as the history row (AC), newest first, so a Member can see whether a change helped. */
export function historyEntry(attempt: { runId: string; at: Date; turns: readonly Turn[] }): NodeHistoryEntry {
  const s = summarizeTurns(attempt.turns);
  return { runId: attempt.runId, at: attempt.at, turns: s.turns, fresh: s.fresh, total: s.total };
}

/**
 * Drops what a target could carry a secret in (#105): a command keeps only its program name and,
 * when the next word is a plain word, its subcommand (`pnpm test`, `git diff`), never leading
 * `VAR=value` assignments or arguments; a URL of any scheme loses its credentials, query and fragment.
 * Safe to apply twice, so the Agent and the Gateway both do.
 */
export function scrubTarget(tool: string | null, raw: string): string {
  const line = (raw.split("\n")[0] ?? "").trim();
  if (tool === "Bash") {
    const words = line.split(/\s+/).filter(Boolean);
    while (words.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0]!)) words.shift();
    const [program, next] = words;
    if (!program) return "";
    return next && /^[A-Za-z][A-Za-z0-9_.-]*$/.test(next) && !/^[a-z][a-z0-9+.-]*:\/\//i.test(next) ? `${program} ${next}` : program;
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(line)) {
    try {
      const url = new URL(line);
      url.username = "";
      url.password = "";
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return line.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/]*@/i, "$1").replace(/[?#].*$/, "");
    }
  }
  return line;
}
