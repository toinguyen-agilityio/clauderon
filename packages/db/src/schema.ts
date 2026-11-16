import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Spec M0 §3. No secrets are stored here (NFR-1): session tokens are hashed
// and OAuth tokens are never kept.

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

export const podStatus = pgEnum("pod_status", ["creating", "running", "stopped", "error", "deleting"]);
export const nodeKind = pgEnum("node_kind", ["ticket", "agent", "command", "approve", "grill"]);
export const runMode = pgEnum("run_mode", ["real", "dry"]);
export const runState = pgEnum("run_state", [
  "queued",
  "running",
  "waiting_for_human",
  "succeeded",
  "failed",
  "interrupted",
  "cancelled",
]);
export const attemptState = pgEnum("attempt_state", ["running", "waiting_for_human", "succeeded", "failed", "interrupted", "cancelled"]);
export const humanRequestKind = pgEnum("human_request_kind", ["approve", "grill"]);
export const logStream = pgEnum("log_stream", ["stdout", "stderr", "system"]);

export const member = pgTable("member", {
  id: id(),
  createdAt: createdAt(),
  email: text("email").notNull().unique(),
  name: text("name"),
  pictureUrl: text("picture_url"),
  lastSignInAt: ts("last_sign_in_at"),
});

/** Links a Google account to a Member for Auth.js; holds no tokens. */
export const memberAccount = pgTable(
  "member_account",
  {
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const allowlistEntry = pgTable("allowlist_entry", {
  email: text("email").primaryKey(),
  addedByEmail: text("added_by_email").notNull(),
  addedAt: ts("added_at").notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: id(),
    createdAt: createdAt(),
    /** SHA-256 of the cookie value; the value itself is never stored. */
    tokenHash: text("token_hash").notNull().unique(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    endedAt: ts("ended_at"),
  },
  (t) => [index("session_member_idx").on(t.memberId)],
);

export const auditEntry = pgTable(
  "audit_entry",
  {
    id: id(),
    createdAt: createdAt(),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    detail: jsonb("detail").notNull().default({}),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("audit_entry_at_idx").on(t.at)],
);

/** A single row (id = 1) describing the Pod Host and its link. */
export const podHost = pgTable("pod_host", {
  id: integer("id").primaryKey().default(1),
  createdAt: createdAt(),
  connected: boolean("connected").notNull().default(false),
  connectedAt: ts("connected_at"),
  lastHeartbeatAt: ts("last_heartbeat_at"),
  agentVersion: text("agent_version"),
  processId: text("process_id"),
  arch: text("arch"),
  cpus: integer("cpus"),
  memoryMb: integer("memory_mb"),
  diskGb: integer("disk_gb"),
  dockerRunning: boolean("docker_running"),
  lastReceivedId: bigint("last_received_id", { mode: "number" }).notNull().default(0),
  lastSentId: bigint("last_sent_id", { mode: "number" }).notNull().default(0),
});

export const pod = pgTable("pod", {
  id: id(),
  createdAt: createdAt(),
  memberId: uuid("member_id")
    .notNull()
    .unique()
    .references(() => member.id),
  containerId: text("container_id"),
  status: podStatus("status").notNull().default("creating"),
  imageTag: text("image_tag").notNull(),
  imageDigest: text("image_digest"),
  slots: integer("slots").notNull(),
  cpus: real("cpus").notNull(),
  memoryMb: integer("memory_mb").notNull(),
  claudeLoggedIn: boolean("claude_logged_in").notNull().default(false),
  ghLoggedIn: boolean("gh_logged_in").notNull().default(false),
  ghAccount: text("gh_account"),
  ghTokenScope: jsonb("gh_token_scope"),
  loginsCheckedAt: ts("logins_checked_at"),
  metrics: jsonb("metrics"),
});

export const project = pgTable(
  "project",
  {
    id: id(),
    createdAt: createdAt(),
    owner: text("owner").notNull(),
    repo: text("repo").notNull(),
    baseBranch: text("base_branch").notNull(),
    enabledByEmail: text("enabled_by_email").notNull(),
  },
  (t) => [uniqueIndex("project_owner_repo_idx").on(t.owner, t.repo)],
);

export const ticket = pgTable(
  "ticket",
  {
    id: id(),
    createdAt: createdAt(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    labels: jsonb("labels").notNull().default([]),
    authorLogin: text("author_login"),
    authorAssociation: text("author_association"),
    issueState: text("issue_state").notNull(),
    url: text("url").notNull(),
    syncedAt: ts("synced_at").notNull(),
  },
  (t) => [uniqueIndex("ticket_project_number_idx").on(t.projectId, t.number)],
);

export type NodeInputJson = { name: string; type: string; required: boolean };
export type NodeOutputJson = { name: string; type: string; optional: boolean };

export const node = pgTable("node", {
  id: id(),
  createdAt: createdAt(),
  /** Stable key of a seeded sample Node, so seeding again updates it. */
  slug: text("slug").unique(),
  name: text("name").notNull(),
  kind: nodeKind("kind").notNull(),
  instructions: text("instructions").notNull().default(""),
  command: text("command"),
  inputs: jsonb("inputs").$type<NodeInputJson[]>().notNull().default([]),
  outputs: jsonb("outputs").$type<NodeOutputJson[]>().notNull().default([]),
  isSample: boolean("is_sample").notNull().default(false),
  updatedByEmail: text("updated_by_email").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const flow = pgTable("flow", {
  id: id(),
  createdAt: createdAt(),
  slug: text("slug").unique(),
  name: text("name").notNull(),
  isSample: boolean("is_sample").notNull().default(false),
  clonedFromId: uuid("cloned_from_id"),
  updatedByEmail: text("updated_by_email").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const flowNode = pgTable("flow_node", {
  id: id(),
  createdAt: createdAt(),
  flowId: uuid("flow_id")
    .notNull()
    .references(() => flow.id, { onDelete: "cascade" }),
  nodeId: uuid("node_id")
    .notNull()
    .references(() => node.id),
  label: text("label"),
  extraInstructions: text("extra_instructions").notNull().default(""),
  enabledOptionalOutputs: jsonb("enabled_optional_outputs").$type<string[]>().notNull().default([]),
  x: real("x").notNull().default(0),
  y: real("y").notNull().default(0),
});

export const flowEdge = pgTable("flow_edge", {
  id: id(),
  createdAt: createdAt(),
  flowId: uuid("flow_id")
    .notNull()
    .references(() => flow.id, { onDelete: "cascade" }),
  fromFlowNodeId: uuid("from_flow_node_id")
    .notNull()
    .references(() => flowNode.id, { onDelete: "cascade" }),
  fromOutput: text("from_output").notNull(),
  toFlowNodeId: uuid("to_flow_node_id")
    .notNull()
    .references(() => flowNode.id, { onDelete: "cascade" }),
  toInput: text("to_input").notNull(),
});

export const batch = pgTable("batch", {
  id: id(),
  createdAt: createdAt(),
  flowId: uuid("flow_id")
    .notNull()
    .references(() => flow.id),
  starterMemberId: uuid("starter_member_id")
    .notNull()
    .references(() => member.id),
  mode: runMode("mode").notNull(),
  extraInstructions: text("extra_instructions").notNull().default(""),
});

export const run = pgTable(
  "run",
  {
    id: id(),
    createdAt: createdAt(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batch.id),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => ticket.id),
    flowId: uuid("flow_id")
      .notNull()
      .references(() => flow.id),
    flowSnapshot: jsonb("flow_snapshot").notNull(),
    podId: uuid("pod_id")
      .notNull()
      .references(() => pod.id),
    starterMemberId: uuid("starter_member_id")
      .notNull()
      .references(() => member.id),
    mode: runMode("mode").notNull(),
    state: runState("state").notNull().default("queued"),
    queuedAt: ts("queued_at").notNull().defaultNow(),
    startedAt: ts("started_at"),
    endedAt: ts("ended_at"),
    branch: text("branch"),
    worktreePath: text("worktree_path"),
    pullRequestNumber: integer("pull_request_number"),
    pullRequestUrl: text("pull_request_url"),
    pullRequestState: text("pull_request_state"),
    failureReason: text("failure_reason"),
  },
  (t) => [
    index("run_queue_idx").on(t.podId, t.state, t.queuedAt),
    // One Active Run per Ticket, Dry-runs excluded (TIC-7).
    uniqueIndex("run_one_active_per_ticket_idx")
      .on(t.ticketId)
      .where(sql`${t.state} not in ('succeeded', 'cancelled') and ${t.mode} = 'real'`),
  ],
);

export const attempt = pgTable("attempt", {
  id: id(),
  createdAt: createdAt(),
  runId: uuid("run_id")
    .notNull()
    .references(() => run.id, { onDelete: "cascade" }),
  flowNodeId: uuid("flow_node_id").notNull(),
  number: integer("number").notNull(),
  state: attemptState("state").notNull().default("running"),
  startedAt: ts("started_at").notNull().defaultNow(),
  endedAt: ts("ended_at"),
  exitCode: integer("exit_code"),
  error: text("error"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  claudeSessionId: text("claude_session_id"),
  retryContext: jsonb("retry_context"),
});

export const output = pgTable("output", {
  id: id(),
  createdAt: createdAt(),
  attemptId: uuid("attempt_id")
    .notNull()
    .references(() => attempt.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  value: jsonb("value").notNull(),
});

export const humanRequest = pgTable("human_request", {
  id: id(),
  createdAt: createdAt(),
  attemptId: uuid("attempt_id")
    .notNull()
    .references(() => attempt.id, { onDelete: "cascade" }),
  kind: humanRequestKind("kind").notNull(),
  round: integer("round").notNull().default(1),
  questions: jsonb("questions"),
  response: jsonb("response"),
  respondedByEmail: text("responded_by_email"),
  respondedAt: ts("responded_at"),
});

export const logChunk = pgTable(
  "log_chunk",
  {
    id: id(),
    createdAt: createdAt(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempt.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    stream: logStream("stream").notNull(),
    text: text("text").notNull(),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("log_chunk_attempt_seq_idx").on(t.attemptId, t.seq)],
);

export const artifact = pgTable("artifact", {
  runId: uuid("run_id")
    .primaryKey()
    .references(() => run.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  content: jsonb("content").notNull(),
});
