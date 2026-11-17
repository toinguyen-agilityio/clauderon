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

export type ClaudeEvent = { log?: string; usage?: { inputTokens: number; outputTokens: number }; sessionId?: string; finalText?: string };

type Usage = { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
type Content = { type: string; text?: string; name?: string; input?: unknown; content?: unknown };

const inputTokens = (u: Usage) => (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);

function short(value: unknown, max = 200): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * Turns one `stream-json` line into what the Host Agent reports: a readable
 * log line, the session id, usage (from the final `result` event) and the
 * final message text. A line that is not JSON is logged as it is.
 */
export function parseClaudeLine(line: string): ClaudeEvent {
  let event: { type?: string; subtype?: string; session_id?: string; message?: { content?: Content[] }; result?: string; usage?: Usage };
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
      const usage = event.usage ? { usage: { inputTokens: inputTokens(event.usage), outputTokens: event.usage.output_tokens ?? 0 } } : {};
      return { ...sessionId, ...usage, finalText: event.result ?? "", log: `[claude] ${event.subtype ?? "result"}` };
    }
    default:
      return { ...sessionId };
  }
}

/** The §6 result of a finished Claude Code run: the last fenced JSON block of its final message. */
export function claudeResult(finalText: string | undefined): unknown {
  return finalText === undefined ? undefined : (extractResultBlock(finalText) ?? undefined);
}
