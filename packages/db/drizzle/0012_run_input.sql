-- Recreated rather than ADD VALUE: migrations run in one transaction, and the next one uses 'input'.
ALTER TYPE "public"."node_kind" RENAME TO "node_kind_old";--> statement-breakpoint
CREATE TYPE "public"."node_kind" AS ENUM('ticket', 'input', 'agent', 'command', 'approve', 'grill');--> statement-breakpoint
ALTER TABLE "node" ALTER COLUMN "kind" TYPE "public"."node_kind" USING "kind"::text::"public"."node_kind";--> statement-breakpoint
DROP TYPE "public"."node_kind_old";--> statement-breakpoint
ALTER TABLE "run" ALTER COLUMN "ticket_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "run" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "run" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "run" ADD COLUMN "input_value" jsonb;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_ticket_or_project" CHECK ("run"."ticket_id" is not null or "run"."project_id" is not null);