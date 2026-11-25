ALTER TABLE "attempt" ADD COLUMN "cache_creation_tokens" integer;--> statement-breakpoint
ALTER TABLE "attempt" ADD COLUMN "cache_read_tokens" integer;--> statement-breakpoint
ALTER TABLE "attempt" ADD COLUMN "turns" jsonb;