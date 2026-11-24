ALTER TABLE "batch" DROP CONSTRAINT "batch_flow_id_flow_id_fk";
--> statement-breakpoint
ALTER TABLE "run" DROP CONSTRAINT "run_flow_id_flow_id_fk";
--> statement-breakpoint
ALTER TABLE "batch" ALTER COLUMN "flow_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "run" ALTER COLUMN "flow_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "batch" ADD CONSTRAINT "batch_flow_id_flow_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flow"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_flow_id_flow_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flow"("id") ON DELETE set null ON UPDATE no action;