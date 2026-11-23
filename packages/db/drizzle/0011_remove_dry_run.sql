-- Dry-run is removed (#130): its Runs never touched GitHub or Claude, so they are deleted (their Attempts, logs and Outputs cascade).
DELETE FROM "run" WHERE "mode" = 'dry';--> statement-breakpoint
DELETE FROM "batch" WHERE "mode" = 'dry';--> statement-breakpoint
DROP INDEX "run_one_active_per_ticket_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "run_one_active_per_ticket_idx" ON "run" USING btree ("ticket_id") WHERE "run"."state" not in ('succeeded', 'cancelled');--> statement-breakpoint
ALTER TABLE "batch" DROP COLUMN "mode";--> statement-breakpoint
ALTER TABLE "run" DROP COLUMN "mode";--> statement-breakpoint
DROP TYPE "public"."run_mode";