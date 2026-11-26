import { z } from "zod";
import { doctorReport } from "./agent-dist";

// Gateway <-> Agent messages (spec M0 §4.2, ADR 0006). Each Agent connects
// with its Machine's own token, so no message names its Machine.

export const messageSchemas = {
  // Control messages: id 0, never buffered or resent.
  hello: z.object({
    agentVersion: z.string(),
    processId: z.string(),
    /** `process.platform`: darwin, linux, win32. */
    os: z.string(),
    arch: z.string(),
    hostname: z.string(),
    cpus: z.number(),
    memoryMb: z.number(),
    diskGb: z.number(),
    lastReceivedId: z.number().int().nonnegative(),
    liveAttempts: z.array(z.string()),
  }),
  welcome: z.object({ lastReceivedId: z.number().int().nonnegative() }),
  ack: z.object({ upTo: z.number().int().nonnegative() }),
  heartbeat: z.object({
    at: z.string(),
    /** What the Machine is using now, shown beside its totals. Optional: older Agents do not send it. */
    usage: z
      .object({
        memoryUsedMb: z.number().nonnegative(),
        diskFreeGb: z.number().nonnegative().optional(),
        /** Busy share of all cores since the previous heartbeat, 0-100. */
        cpuPercent: z.number().min(0).max(100),
      })
      .optional(),
  }),

  // Machine logins (POD-5): checked before each Run's first Node.
  "machine.checkLogins": z.object({}),
  "machine.logins": z.object({
    claude: z.boolean(),
    gh: z.boolean(),
    ghAccount: z.string().nullable(),
    /** The Claude account's email and plan, when Claude Code says (optional: older Agents do not send them). */
    claudeAccount: z.string().nullable().optional(),
    claudePlan: z.string().nullable().optional(),
    tokenRepos: z.array(z.string()),
    checkedAt: z.string(),
  }),
  /** The Agent's doctor (ADR 0007): at start and with every login check. Older Agents never send it. */
  "machine.doctor": doctorReport,

  // Workspaces and Nodes (M1, M3, M4)
  "workspace.prepare": z.object({
    runId: z.string(),
    owner: z.string(),
    repo: z.string(),
    baseBranch: z.string(),
    branch: z.string(),
    /** Files to download from `GET <gateway>/agent/attachments/<id>` into the worktree (ADR 0011). */
    attachments: z.array(z.object({ id: z.string(), name: z.string(), size: z.number().int(), sha256: z.string() })).optional(),
  }),
  /** `attachments`: how many attached files the Agent wrote and checked. */
  "workspace.ready": z.object({ runId: z.string(), worktreePath: z.string(), attachments: z.number().int().optional() }),
  "workspace.failed": z.object({ runId: z.string(), error: z.string() }),
  /** A Run ended Succeeded or Cancelled (RUN-14): remove its worktree and local branch; the pushed branch stays on GitHub. */
  "workspace.cleanup": z.object({ runId: z.string(), worktreePath: z.string(), owner: z.string(), repo: z.string(), branch: z.string() }),
  /** The worktree and local branch are gone (or were already); until then the Gateway asks again on each connect. */
  "workspace.cleaned": z.object({ runId: z.string() }),
  "node.run": z.object({
    attemptId: z.string(),
    runId: z.string(),
    worktreePath: z.string(),
    kind: z.enum(["agent", "command"]),
    prompt: z.string().optional(),
    command: z.string().optional(),
    resumeSessionId: z.string().optional(),
    /** The Node's Claude model and turn limit (#218). Optional: an older Gateway sends neither, an older Agent ignores them. */
    model: z.string().optional(),
    maxTurns: z.number().int().positive().optional(),
    env: z.record(z.string(), z.string()),
    /** The Run's attached files, which must still be in the worktree (ADR 0011). */
    attachments: z.array(z.object({ name: z.string(), sha256: z.string() })).optional(),
  }),
  "node.log": z.object({
    attemptId: z.string(),
    seq: z.number().int(),
    stream: z.enum(["stdout", "stderr", "system"]),
    text: z.string(),
  }),
  "node.usage": z.object({
    attemptId: z.string(),
    /** All input: new, cache created and cache read together (what older Agents send). */
    inputTokens: z.number().int(),
    outputTokens: z.number().int(),
    /** The split of `inputTokens` (#105). Optional: older Agents do not send it. */
    cacheCreated: z.number().int().nonnegative().optional(),
    cacheRead: z.number().int().nonnegative().optional(),
  }),
  /** What an Agent Node did, one entry per turn (#105): sizes and names only. Older Agents never send it. */
  "node.turns": z.object({
    attemptId: z.string(),
    // At most MAX_TURNS_PER_MESSAGE of @clauderon/core; a longer session is sent in several messages.
    turns: z
      .array(
        z.object({
          index: z.number().int().nonnegative(),
          calls: z
            .array(
              z.object({
                tool: z.string().max(64),
                // MAX_TARGET_LENGTH (120) plus the ellipsis; the Gateway keeps nothing longer.
                target: z.string().max(121).nullable(),
                resultBytes: z.number().int().nonnegative().nullable(),
              }),
            )
            .max(64),
          newInput: z.number().int().nonnegative(),
          cacheCreated: z.number().int().nonnegative(),
          cacheRead: z.number().int().nonnegative(),
          output: z.number().int().nonnegative(),
        }),
      )
      .max(2000),
  }),
  "node.result": z.object({
    attemptId: z.string(),
    exitCode: z.number().int(),
    result: z.unknown().optional(),
    sessionId: z.string().optional(),
    headCommit: z.string().optional(),
    error: z.string().optional(),
    /** The Claude session stopped at its turn limit and can be resumed (#218); `error` says so too, for an older Gateway. */
    maxTurnsReached: z.boolean().optional(),
    diff: z.object({ text: z.string(), truncated: z.boolean() }).optional(),
    files: z.array(z.object({ name: z.string(), contentType: z.string(), base64: z.string() })).optional(),
  }),
  "node.kill": z.object({ attemptId: z.string() }),
  "pr.writeBody": z.object({ runId: z.string(), worktreePath: z.string(), body: z.string() }),

  // Flow Drafts (ADR 0008): one Claude Code call outside any Run, in the draft's own empty
  // directory, so a later call can resume its session. Agents before 0.5.0 do not know them.
  "flow.draft": z.object({
    draftId: z.string().uuid(),
    /** One call of the draft; the answer names it. */
    jobId: z.string(),
    prompt: z.string(),
    resumeSessionId: z.string().optional(),
  }),
  "flow.drafted": z.object({
    jobId: z.string(),
    exitCode: z.number().int(),
    /** Claude's final message, masked. */
    finalText: z.string().optional(),
    sessionId: z.string().optional(),
    error: z.string().optional(),
    /** `--resume` named a session Claude Code no longer has. */
    unknownSession: z.boolean().optional(),
  }),
  "flow.draftKill": z.object({ jobId: z.string() }),

} as const;

export type MessageType = keyof typeof messageSchemas;
export type Payload<T extends MessageType> = z.infer<(typeof messageSchemas)[T]>;

export const CONTROL_TYPES = ["hello", "welcome", "ack", "heartbeat"] as const satisfies readonly MessageType[];
export type ControlType = (typeof CONTROL_TYPES)[number];

export function isMessageType(type: string): type is MessageType {
  return Object.hasOwn(messageSchemas, type);
}

/** Close codes on the Host Agent and browser sockets. */
export const CloseCode = {
  /** Unknown Machine token, or no session. */
  Unauthorized: 4401,
  /** The Member's access was removed (MEM-3). */
  Revoked: 4403,
  /** Not the Member's to open. */
  NotFound: 4404,
  /** No heartbeat for too long (RUN-12): the Gateway dropped the link; the Agent reconnects. */
  Silent: 4408,
  /** A newer connection of the same Machine replaced this one. */
  Replaced: 4409,
} as const;
