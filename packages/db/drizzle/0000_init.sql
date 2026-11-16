CREATE TYPE "public"."attempt_state" AS ENUM('running', 'waiting_for_human', 'succeeded', 'failed', 'interrupted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."human_request_kind" AS ENUM('approve', 'grill');--> statement-breakpoint
CREATE TYPE "public"."log_stream" AS ENUM('stdout', 'stderr', 'system');--> statement-breakpoint
CREATE TYPE "public"."node_kind" AS ENUM('ticket', 'agent', 'command', 'approve', 'grill');--> statement-breakpoint
CREATE TYPE "public"."pod_status" AS ENUM('creating', 'running', 'stopped', 'error', 'deleting');--> statement-breakpoint
CREATE TYPE "public"."run_mode" AS ENUM('real', 'dry');--> statement-breakpoint
CREATE TYPE "public"."run_state" AS ENUM('queued', 'running', 'waiting_for_human', 'succeeded', 'failed', 'interrupted', 'cancelled');--> statement-breakpoint
CREATE TABLE "allowlist_entry" (
	"email" text PRIMARY KEY NOT NULL,
	"added_by_email" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifact" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"run_id" uuid NOT NULL,
	"flow_node_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"state" "attempt_state" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"exit_code" integer,
	"error" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"claude_session_id" text,
	"retry_context" jsonb
);
--> statement-breakpoint
CREATE TABLE "audit_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_email" text NOT NULL,
	"action" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"flow_id" uuid NOT NULL,
	"starter_member_id" uuid NOT NULL,
	"mode" "run_mode" NOT NULL,
	"extra_instructions" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"slug" text,
	"name" text NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"cloned_from_id" uuid,
	"updated_by_email" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flow_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "flow_edge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"flow_id" uuid NOT NULL,
	"from_flow_node_id" uuid NOT NULL,
	"from_output" text NOT NULL,
	"to_flow_node_id" uuid NOT NULL,
	"to_input" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_node" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"flow_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"label" text,
	"extra_instructions" text DEFAULT '' NOT NULL,
	"enabled_optional_outputs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"x" real DEFAULT 0 NOT NULL,
	"y" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "human_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"kind" "human_request_kind" NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"questions" jsonb,
	"response" jsonb,
	"responded_by_email" text,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "log_chunk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"stream" "log_stream" NOT NULL,
	"text" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"picture_url" text,
	"last_sign_in_at" timestamp with time zone,
	CONSTRAINT "member_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "member_account" (
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_account_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "node" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"slug" text,
	"name" text NOT NULL,
	"kind" "node_kind" NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"command" text,
	"inputs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"outputs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"updated_by_email" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "node_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "output" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pod" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"member_id" uuid NOT NULL,
	"container_id" text,
	"status" "pod_status" DEFAULT 'creating' NOT NULL,
	"image_tag" text NOT NULL,
	"image_digest" text,
	"slots" integer NOT NULL,
	"cpus" real NOT NULL,
	"memory_mb" integer NOT NULL,
	"claude_logged_in" boolean DEFAULT false NOT NULL,
	"gh_logged_in" boolean DEFAULT false NOT NULL,
	"gh_account" text,
	"gh_token_scope" jsonb,
	"logins_checked_at" timestamp with time zone,
	"metrics" jsonb,
	CONSTRAINT "pod_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
CREATE TABLE "pod_host" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"connected" boolean DEFAULT false NOT NULL,
	"connected_at" timestamp with time zone,
	"last_heartbeat_at" timestamp with time zone,
	"agent_version" text,
	"process_id" text,
	"arch" text,
	"cpus" integer,
	"memory_mb" integer,
	"disk_gb" integer,
	"docker_running" boolean,
	"last_received_id" bigint DEFAULT 0 NOT NULL,
	"last_sent_id" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"base_branch" text NOT NULL,
	"enabled_by_email" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"batch_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"flow_id" uuid NOT NULL,
	"flow_snapshot" jsonb NOT NULL,
	"pod_id" uuid NOT NULL,
	"starter_member_id" uuid NOT NULL,
	"mode" "run_mode" NOT NULL,
	"state" "run_state" DEFAULT 'queued' NOT NULL,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"branch" text,
	"worktree_path" text,
	"pull_request_number" integer,
	"pull_request_url" text,
	"pull_request_state" text,
	"failure_reason" text
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"token_hash" text NOT NULL,
	"member_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "session_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "ticket" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"project_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"author_login" text,
	"author_association" text,
	"issue_state" text NOT NULL,
	"url" text NOT NULL,
	"synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artifact" ADD CONSTRAINT "artifact_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt" ADD CONSTRAINT "attempt_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch" ADD CONSTRAINT "batch_flow_id_flow_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flow"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch" ADD CONSTRAINT "batch_starter_member_id_member_id_fk" FOREIGN KEY ("starter_member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_edge" ADD CONSTRAINT "flow_edge_flow_id_flow_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_edge" ADD CONSTRAINT "flow_edge_from_flow_node_id_flow_node_id_fk" FOREIGN KEY ("from_flow_node_id") REFERENCES "public"."flow_node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_edge" ADD CONSTRAINT "flow_edge_to_flow_node_id_flow_node_id_fk" FOREIGN KEY ("to_flow_node_id") REFERENCES "public"."flow_node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_node" ADD CONSTRAINT "flow_node_flow_id_flow_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_node" ADD CONSTRAINT "flow_node_node_id_node_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."node"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_request" ADD CONSTRAINT "human_request_attempt_id_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_chunk" ADD CONSTRAINT "log_chunk_attempt_id_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_account" ADD CONSTRAINT "member_account_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "output" ADD CONSTRAINT "output_attempt_id_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pod" ADD CONSTRAINT "pod_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_batch_id_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_ticket_id_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."ticket"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_flow_id_flow_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flow"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_pod_id_pod_id_fk" FOREIGN KEY ("pod_id") REFERENCES "public"."pod"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_starter_member_id_member_id_fk" FOREIGN KEY ("starter_member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entry_at_idx" ON "audit_entry" USING btree ("at");--> statement-breakpoint
CREATE INDEX "log_chunk_attempt_seq_idx" ON "log_chunk" USING btree ("attempt_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "project_owner_repo_idx" ON "project" USING btree ("owner","repo");--> statement-breakpoint
CREATE INDEX "run_queue_idx" ON "run" USING btree ("pod_id","state","queued_at");--> statement-breakpoint
CREATE UNIQUE INDEX "run_one_active_per_ticket_idx" ON "run" USING btree ("ticket_id") WHERE "run"."state" not in ('succeeded', 'cancelled') and "run"."mode" = 'real';--> statement-breakpoint
CREATE INDEX "session_member_idx" ON "session" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_project_number_idx" ON "ticket" USING btree ("project_id","number");