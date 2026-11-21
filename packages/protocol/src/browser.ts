import { z } from "zod";

// Browser <-> Gateway messages (spec M1 §5.1): live logs and Run changes on `/browser`.

export const browserRequest = z.discriminatedUnion("type", [
  /** Live log lines of one Attempt, after `afterSeq` (backfilled from storage first). */
  z.object({ type: z.literal("subscribe.log"), attemptId: z.string(), afterSeq: z.number().int().optional() }),
  z.object({ type: z.literal("unsubscribe.log"), attemptId: z.string() }),
  /** A `run.changed` whenever the Run's state or Attempts change. */
  z.object({ type: z.literal("subscribe.run"), runId: z.string() }),
  /** A Flow Draft (ADR 0008) on the Member's own Machine, from a description. */
  z.object({ type: z.literal("draft.start"), draftId: z.string().uuid(), description: z.string().min(1).max(4_000) }),
  /** Change the draft as the note says; `flow` is the draft the browser shows, for when the session is gone. */
  z.object({ type: z.literal("draft.revise"), draftId: z.string().uuid(), description: z.string().max(4_000), flow: z.string().max(1_000_000), note: z.string().min(1).max(4_000) }),
  z.object({ type: z.literal("draft.cancel"), draftId: z.string().uuid() }),
]);
export type BrowserRequest = z.infer<typeof browserRequest>;

export type BrowserEvent =
  | { type: "log"; attemptId: string; seq: number; stream: "stdout" | "stderr" | "system"; text: string }
  | { type: "run.changed"; runId: string }
  /** A checked Flow file (JSON text) and the names of the Nodes it would add to the library. */
  | { type: "draft.ready"; draftId: string; flow: string; newNodes: string[] }
  | { type: "draft.failed"; draftId: string; error: string };

/** Parses a browser message with `schema`, or null when it is not valid. */
export function parseBrowserMessage<T>(schema: z.ZodType<T>, text: string): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
