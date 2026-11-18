ALTER TABLE "attempt" ADD COLUMN "superseded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "run" ADD COLUMN "pending_retry" jsonb;