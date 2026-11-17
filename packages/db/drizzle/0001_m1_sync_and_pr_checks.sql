ALTER TABLE "project" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "sync_summary" jsonb;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "sync_error" text;--> statement-breakpoint
ALTER TABLE "run" ADD COLUMN "pull_request_checked_at" timestamp with time zone;