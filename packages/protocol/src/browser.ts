import { z } from "zod";

// Browser <-> Gateway messages (spec M1 §2.5, §5.1): live logs and Run
// changes on `/browser`, keystrokes and screen output on `/terminal`.

export const browserRequest = z.discriminatedUnion("type", [
  /** Live log lines of one Attempt, after `afterSeq` (backfilled from storage first). */
  z.object({ type: z.literal("subscribe.log"), attemptId: z.string(), afterSeq: z.number().int().optional() }),
  z.object({ type: z.literal("unsubscribe.log"), attemptId: z.string() }),
  /** A `run.changed` whenever the Run's state or Attempts change. */
  z.object({ type: z.literal("subscribe.run"), runId: z.string() }),
]);
export type BrowserRequest = z.infer<typeof browserRequest>;

export type BrowserEvent =
  | { type: "log"; attemptId: string; seq: number; stream: "stdout" | "stderr" | "system"; text: string }
  | { type: "run.changed"; runId: string };

export const terminalRequest = z.discriminatedUnion("type", [
  z.object({ type: z.literal("input"), data: z.string() }),
  z.object({ type: z.literal("resize"), cols: z.number().int().min(2).max(1000), rows: z.number().int().min(2).max(1000) }),
]);
export type TerminalRequest = z.infer<typeof terminalRequest>;

export type TerminalEvent = { type: "output"; data: string };

/** Parses a browser message with `schema`, or null when it is not valid. */
export function parseBrowserMessage<T>(schema: z.ZodType<T>, text: string): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
