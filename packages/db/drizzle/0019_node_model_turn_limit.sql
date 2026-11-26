ALTER TYPE "public"."human_request_kind" ADD VALUE 'turns';--> statement-breakpoint
ALTER TABLE "node" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "node" ADD COLUMN "max_turns" integer;