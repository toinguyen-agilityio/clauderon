import { extractResultBlock, MAX_TARGET_LENGTH, scrubTarget, type Turn } from "@clauderon/core";

/**
 * Headless Claude Code (spec M0 §6). These are the expected flags; the M0
 * spike (docs/specs/notes/claude-headless.md) has not confirmed them yet, so
 * they live here, in one place, to change once it has.
 */
export const CLAUDE_ARGS = ["-p", "--output-format", "stream-json", "--verbose", "--dangerously-skip-permissions"] as const;

/** The shell line that runs Claude Code on the prompt file named by `$CLAUDERON_PROMPT_FILE`. */
export function claudeCommand(resumeSessionId?: string): string {
  const resume = resumeSessionId ? ` --resume '${resumeSessionId.replace(/[^A-Za-z0-9-]/g, "")}'` : "";
  return `claude ${CLAUDE_ARGS.join(" ")}${resume} < "$CLAUDERON_PROMPT_FILE"`;
}

/**
 * A Flow Draft's call (ADR 0008): it only answers, so it runs without skipping permissions;
 * in print mode any tool that would need one is refused.
 */
export function draftClaudeCommand(resumeSessionId?: string): string {
  const resume = resumeSessionId ? ` --resume '${resumeSessionId.replace(/[^A-Za-z0-9-]/g, "")}'` : "";
  return `claude -p --output-format stream-json --verbose${resume} < "$CLAUDERON_PROMPT_FILE"`;
}

export type ClaudeEvent = {
  log?: string;
  usage?: { inputTokens: number; outputTokens: number; cacheCreated: number; cacheRead: number };
  /** One assistant API message (#105): its token split and the tools it called. Sizes and names only. */
  message?: { id: string; newInput: number; cacheCreated: number; cacheRead: number; output: number; tools: { id: string; name: string; target: string | null }[] };
  /** Sizes of the tool results a `user` event carried, by the tool call's id. */
  toolResults?: { id: string; bytes: number }[];
  sessionId?: string;
  finalText?: string;
  /** Claude Code's own error message, from a `result` event marked as an error. */
  error?: string;
};

type Usage = { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
type Content = { type: string; text?: string; id?: string; name?: string; input?: unknown; content?: unknown; tool_use_id?: string };

type ModelUsage = { inputTokens?: number; outputTokens?: number; cacheCreationInputTokens?: number; cacheReadInputTokens?: number };

const inputTokens = (u: Usage) => (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);

/**
 * The tokens of the whole session. `modelUsage` counts subagents and stays cumulative across
 * `--resume`, so a Grill Attempt's latest report is its total; `usage` covers neither and is only
 * the fallback for a Claude Code that does not send `modelUsage`.
 */
function sessionUsage(usage: Usage | undefined, byModel: Record<string, ModelUsage> | undefined): ClaudeEvent["usage"] {
  const models = Object.values(byModel ?? {});
  if (models.length > 0) {
    return {
      inputTokens: models.reduce((sum, m) => sum + (m.inputTokens ?? 0) + (m.cacheCreationInputTokens ?? 0) + (m.cacheReadInputTokens ?? 0), 0),
      outputTokens: models.reduce((sum, m) => sum + (m.outputTokens ?? 0), 0),
      cacheCreated: models.reduce((sum, m) => sum + (m.cacheCreationInputTokens ?? 0), 0),
      cacheRead: models.reduce((sum, m) => sum + (m.cacheReadInputTokens ?? 0), 0),
    };
  }
  return usage
    ? { inputTokens: inputTokens(usage), outputTokens: usage.output_tokens ?? 0, cacheCreated: usage.cache_creation_input_tokens ?? 0, cacheRead: usage.cache_read_input_tokens ?? 0 }
    : undefined;
}

function short(value: unknown, max = 200): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** What a tool call was aimed at: a path, a command, a pattern or a URL. */
function toolTarget(input: unknown): string | null {
  if (typeof input !== "object" || input === null) return null;
  const o = input as Record<string, unknown>;
  const value = [o.file_path, o.notebook_path, o.path, o.command, o.pattern, o.url, o.query].find((v): v is string => typeof v === "string" && v !== "");
  return value ?? null;
}

/** The size of a tool result's content in bytes, whatever its shape; the content itself is never kept. */
function byteSize(content: unknown): number {
  if (typeof content === "string") return Buffer.byteLength(content);
  if (Array.isArray(content)) return content.reduce<number>((n, part) => n + byteSize(typeof part === "object" && part !== null && "text" in part ? (part as { text: unknown }).text : part), 0);
  return content === undefined || content === null ? 0 : Buffer.byteLength(JSON.stringify(content));
}

const firstLine = (text: string | undefined) => (text ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";

/**
 * Turns one `stream-json` line into what the Host Agent reports: a readable
 * log line, the session id, usage (from the final `result` event) and the
 * final message text. A line that is not JSON is logged as it is.
 */
export function parseClaudeLine(line: string): ClaudeEvent {
  let event: {
    type?: string;
    subtype?: string;
    is_error?: boolean;
    session_id?: string;
    message?: { id?: string; content?: Content[]; usage?: Usage };
    result?: string;
    errors?: unknown;
    usage?: Usage;
    modelUsage?: Record<string, ModelUsage>;
  };
  try {
    event = JSON.parse(line);
  } catch {
    return { log: line };
  }
  const sessionId = event.session_id ? { sessionId: event.session_id } : {};
  switch (event.type) {
    case "system":
      return { ...sessionId, log: `[claude] ${event.subtype ?? "system"}` };
    case "assistant": {
      const parts = (event.message?.content ?? []).map((c) =>
        c.type === "text" ? (c.text ?? "") : c.type === "tool_use" ? `[tool] ${c.name ?? "?"} ${short(c.input)}` : `[${c.type}]`,
      );
      const usage = event.message?.usage;
      const message =
        event.message?.id && usage
          ? {
              message: {
                id: event.message.id,
                newInput: usage.input_tokens ?? 0,
                cacheCreated: usage.cache_creation_input_tokens ?? 0,
                cacheRead: usage.cache_read_input_tokens ?? 0,
                output: usage.output_tokens ?? 0,
                tools: (event.message.content ?? []).filter((c) => c.type === "tool_use" && c.id).map((c) => ({ id: c.id!, name: c.name ?? "?", target: toolTarget(c.input) })),
              },
            }
          : {};
      return { ...sessionId, ...message, log: parts.join("\n") };
    }
    case "user": {
      const results = (event.message?.content ?? []).filter((c) => c.type === "tool_result").map((c) => `[result] ${short(c.content)}`);
      const sizes = (event.message?.content ?? []).filter((c) => c.type === "tool_result" && c.tool_use_id).map((c) => ({ id: c.tool_use_id!, bytes: byteSize(c.content) }));
      return { ...sessionId, ...(sizes.length > 0 ? { toolResults: sizes } : {}), log: results.join("\n") || undefined };
    }
    case "result": {
      const total = sessionUsage(event.usage, event.modelUsage);
      const usage = total ? { usage: total } : {};
      const failed = event.is_error === true || event.subtype?.startsWith("error") === true;
      const message = failed ? firstLine(event.result) || firstLine(Array.isArray(event.errors) ? event.errors.filter((e) => typeof e === "string").join("\n") : undefined) : "";
      return {
        ...sessionId,
        ...usage,
        finalText: event.result ?? "",
        ...(failed ? { error: message || event.subtype || "error" } : {}),
        log: `[claude] ${event.subtype ?? "result"}`,
      };
    }
    default:
      return { ...sessionId };
  }
}

/** The §6 result of a finished Claude Code run: the last fenced JSON block of its final message. */
export function claudeResult(finalText: string | undefined): unknown {
  return finalText === undefined ? undefined : (extractResultBlock(finalText) ?? undefined);
}

/** Lines that read like a Claude Code or API error, for when no `result` event says so. */
const CLAUDE_ERROR = /\b(limit|rate.?limit|usage|quota|credit|overloaded|api error|authenticat|unauthori[sz]ed|forbidden|log ?in|logged out|invalid api key|error)\b/i;
const MAX_REASON = 300;

/**
 * Collects the clearest error message of a Claude Code run, so a failed Node
 * says why ("You've hit your 5-hour limit…") and not just its exit code.
 * Preference: the `result` event's error, then the last stderr line, then the
 * last stdout line that reads like an error.
 */
export class ClaudeErrorWatch {
  private fromResult: string | undefined;
  private lastStderr: string | undefined;
  private lastErrorLike: string | undefined;

  event(event: ClaudeEvent): void {
    if (event.error) this.fromResult = event.error;
    for (const line of (event.log ?? "").split("\n")) if (!line.startsWith("[") && CLAUDE_ERROR.test(line)) this.lastErrorLike = line.trim();
  }

  stderr(line: string): void {
    if (line.trim()) this.lastStderr = line.trim();
  }

  /** The failure reason for a non-zero exit: `Claude Code exited <code>`, plus the message when there is one. */
  reason(exitCode: number): string {
    const base = `Claude Code exited ${exitCode}`;
    const message = this.fromResult ?? this.lastStderr ?? this.lastErrorLike;
    if (!message) return base;
    return `${base}: ${message.length > MAX_REASON ? `${message.slice(0, MAX_REASON)}…` : message}`;
  }
}

/**
 * Builds the per-turn summary of an Agent Node (#105) from its parsed events: one
 * Turn per assistant API message, with the tokens of that call and the size of
 * its tool's result. Targets are masked, made relative to the worktree and truncated.
 */
export class TurnRecorder {
  private readonly turnList: Turn[] = [];
  private readonly byMessage = new Map<string, Turn>();
  private readonly byTool = new Map<string, Turn>();

  constructor(
    private readonly hide: (text: string) => string,
    private readonly worktreePath: string,
  ) {}

  event(event: ClaudeEvent): void {
    const m = event.message;
    if (m) {
      // One API message can arrive as several events (one per content block): the same turn, latest usage.
      let turn = this.byMessage.get(m.id);
      if (!turn) {
        turn = { index: this.turnList.length, tool: null, target: null, resultBytes: null, newInput: 0, cacheCreated: 0, cacheRead: 0, output: 0 };
        this.byMessage.set(m.id, turn);
        this.turnList.push(turn);
      }
      turn.newInput = m.newInput;
      turn.cacheCreated = m.cacheCreated;
      turn.cacheRead = m.cacheRead;
      turn.output = Math.max(turn.output, m.output);
      const first = m.tools[0];
      if (first && turn.tool === null) {
        turn.tool = first.name;
        turn.target = first.target === null ? null : this.target(first.name, first.target);
      }
      for (const tool of m.tools) this.byTool.set(tool.id, turn);
    }
    for (const r of event.toolResults ?? []) {
      const turn = this.byTool.get(r.id);
      if (turn) turn.resultBytes = (turn.resultBytes ?? 0) + r.bytes;
    }
  }

  /** The turns so far, in order. */
  turns(): Turn[] {
    return this.turnList.map((t) => ({ ...t }));
  }

  /**
   * Paths stay (relative to the worktree); a command keeps only its first two words and a URL loses
   * its credentials and query, since arguments are where secrets end up. Then masked and truncated.
   */
  private target(tool: string, raw: string): string {
    let kept = scrubTarget(tool, raw);
    if (tool !== "Bash" && !/^[a-z][a-z0-9+.-]*:\/\//i.test(kept)) {
      const path = kept.replaceAll("\\", "/");
      const root = this.worktreePath.replaceAll("\\", "/").replace(/\/+$/, "");
      kept = root && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
    }
    const masked = this.hide(kept);
    return masked.length > MAX_TARGET_LENGTH ? `${masked.slice(0, MAX_TARGET_LENGTH)}…` : masked;
  }
}
