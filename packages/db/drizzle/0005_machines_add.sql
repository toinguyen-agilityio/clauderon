CREATE TABLE "machine" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"member_id" uuid NOT NULL,
	"name" text,
	"token_hash" text,
	"paired_at" timestamp with time zone,
	"hostname" text,
	"os" text,
	"arch" text,
	"agent_version" text,
	"process_id" text,
	"cpus" integer,
	"memory_mb" integer,
	"disk_gb" integer,
	"connected" boolean DEFAULT false NOT NULL,
	"connected_at" timestamp with time zone,
	"last_heartbeat_at" timestamp with time zone,
	"last_received_id" bigint DEFAULT 0 NOT NULL,
	"last_sent_id" bigint DEFAULT 0 NOT NULL,
	"slots" integer DEFAULT 2 NOT NULL,
	"claude_logged_in" boolean DEFAULT false NOT NULL,
	"gh_logged_in" boolean DEFAULT false NOT NULL,
	"gh_account" text,
	"gh_token_scope" jsonb,
	"logins_checked_at" timestamp with time zone,
	CONSTRAINT "machine_member_id_unique" UNIQUE("member_id"),
	CONSTRAINT "machine_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "pairing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" text NOT NULL,
	"token_hash" text NOT NULL,
	"hostname" text NOT NULL,
	"os" text NOT NULL,
	"arch" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by_member_id" uuid,
	CONSTRAINT "pairing_code_unique" UNIQUE("code"),
	CONSTRAINT "pairing_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "run" ADD COLUMN "machine_id" uuid;--> statement-breakpoint
ALTER TABLE "machine" ADD CONSTRAINT "machine_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing" ADD CONSTRAINT "pairing_approved_by_member_id_member_id_fk" FOREIGN KEY ("approved_by_member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_machine_id_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machine"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "run_machine_queue_idx" ON "run" USING btree ("machine_id","state","queued_at");