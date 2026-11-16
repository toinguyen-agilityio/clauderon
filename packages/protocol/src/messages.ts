import { z } from "zod";

// Gateway <-> Host Agent messages (spec M0 §4.2). Defined in M0 even when a
// later milestone implements them, so the protocol is frozen.

const podStatus = z.enum(["creating", "running", "stopped", "error", "deleting"]);
const podCommand = z.object({ podId: z.string(), image: z.string(), cpus: z.number(), memoryMb: z.number() });
const terminalCommand = z.object({
  sessionId: z.string(),
  podId: z.string(),
  data: z.string().optional(),
  cols: z.number().int().optional(),
  rows: z.number().int().optional(),
});

export const messageSchemas = {
  // Control messages: id 0, never buffered or resent.
  hello: z.object({
    agentVersion: z.string(),
    processId: z.string(),
    arch: z.string(),
    cpus: z.number(),
    memoryMb: z.number(),
    diskGb: z.number(),
    dockerRunning: z.boolean(),
    lastReceivedId: z.number().int().nonnegative(),
    liveAttempts: z.array(z.string()),
  }),
  welcome: z.object({ lastReceivedId: z.number().int().nonnegative(), podImage: z.string() }),
  ack: z.object({ upTo: z.number().int().nonnegative() }),
  heartbeat: z.object({
    at: z.string(),
    pods: z.array(z.object({ podId: z.string(), status: podStatus, metrics: z.record(z.string(), z.unknown()).optional() })),
  }),

  // Pods (M1, M4)
  "pod.create": podCommand,
  "pod.start": podCommand,
  "pod.stop": podCommand,
  "pod.recreate": podCommand,
  "pod.delete": podCommand,
  "pod.status": z.object({
    podId: z.string(),
    status: podStatus,
    containerId: z.string().nullable(),
    imageDigest: z.string().nullable(),
    error: z.string().optional(),
  }),
  "pod.checkLogins": z.object({ podId: z.string() }),
  "pod.logins": z.object({
    podId: z.string(),
    claude: z.boolean(),
    gh: z.boolean(),
    ghAccount: z.string().nullable(),
    tokenRepos: z.array(z.string()),
    checkedAt: z.string(),
  }),

  // Workspaces and Nodes (M1, M3, M4)
  "workspace.prepare": z.object({
    runId: z.string(),
    podId: z.string(),
    owner: z.string(),
    repo: z.string(),
    baseBranch: z.string(),
    branch: z.string(),
  }),
  "workspace.ready": z.object({ runId: z.string(), worktreePath: z.string() }),
  "workspace.failed": z.object({ runId: z.string(), error: z.string() }),
  "workspace.cleanup": z.object({ runId: z.string(), podId: z.string(), worktreePath: z.string() }),
  "node.run": z.object({
    attemptId: z.string(),
    runId: z.string(),
    podId: z.string(),
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
  "pr.writeBody": z.object({ runId: z.string(), podId: z.string(), worktreePath: z.string(), body: z.string() }),

  // Terminals (M1)
  "terminal.open": terminalCommand,
  "terminal.input": terminalCommand,
  "terminal.resize": terminalCommand,
  "terminal.close": terminalCommand,
  "terminal.output": z.object({ sessionId: z.string(), data: z.string().optional() }),
  "terminal.closed": z.object({ sessionId: z.string(), exitCode: z.number().int().optional() }),

  // Images (M4)
  "image.check": z.object({ tag: z.string() }),
  "image.status": z.object({ tag: z.string(), digest: z.string().nullable() }),
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
  /** Wrong Host Agent secret or no session. */
  Unauthorized: 4401,
  /** The Member's access was removed (MEM-3). */
  Revoked: 4403,
  /** A newer Host Agent connection replaced this one. */
  Replaced: 4409,
} as const;
