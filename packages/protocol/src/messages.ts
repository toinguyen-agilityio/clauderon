import { z } from "zod";

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
  heartbeat: z.object({ at: z.string() }),

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

  // Workspaces and Nodes (M1, M3, M4)
  "workspace.prepare": z.object({
    runId: z.string(),
    owner: z.string(),
    repo: z.string(),
    baseBranch: z.string(),
    branch: z.string(),
  }),
  "workspace.ready": z.object({ runId: z.string(), worktreePath: z.string() }),
  "workspace.failed": z.object({ runId: z.string(), error: z.string() }),
  "workspace.cleanup": z.object({ runId: z.string(), worktreePath: z.string() }),
  "node.run": z.object({
    attemptId: z.string(),
    runId: z.string(),
    worktreePath: z.string(),
    kind: z.enum(["agent", "command"]),
    prompt: z.string().optional(),
    command: z.string().optional(),
    resumeSessionId: z.string().optional(),
    env: z.record(z.string(), z.string()),
  }),
  "node.log": z.object({
    attemptId: z.string(),
    seq: z.number().int(),
    stream: z.enum(["stdout", "stderr", "system"]),
    text: z.string(),
  }),
  "node.usage": z.object({ attemptId: z.string(), inputTokens: z.number().int(), outputTokens: z.number().int() }),
  "node.result": z.object({
    attemptId: z.string(),
    exitCode: z.number().int(),
    result: z.unknown().optional(),
    sessionId: z.string().optional(),
    headCommit: z.string().optional(),
    error: z.string().optional(),
    diff: z.object({ text: z.string(), truncated: z.boolean() }).optional(),
    files: z.array(z.object({ name: z.string(), contentType: z.string(), base64: z.string() })).optional(),
  }),
  "node.kill": z.object({ attemptId: z.string() }),
  "pr.writeBody": z.object({ runId: z.string(), worktreePath: z.string(), body: z.string() }),

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
