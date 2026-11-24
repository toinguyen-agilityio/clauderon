import { extractResultBlock } from "@clauderon/core";

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
  usage?: { inputTokens: number; outputTokens: number };
  sessionId?: string;
  finalText?: string;
  /** Claude Code's own error message, from a `result` event marked as an error. */
  error?: string;
};

type Usage = { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
type Content = { type: string; text?: string; name?: string; input?: unknown; content?: unknown };

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
    };
  }
  return usage ? { inputTokens: inputTokens(usage), outputTokens: usage.output_tokens ?? 0 } : undefined;
}

function short(value: unknown, max = 200): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
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
    message?: { content?: Content[] };
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
      return { ...sessionId, log: parts.join("\n") };
    }
    case "user": {
      const results = (event.message?.content ?? []).filter((c) => c.type === "tool_result").map((c) => `[result] ${short(c.content)}`);
      return { ...sessionId, log: results.join("\n") || undefined };
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
