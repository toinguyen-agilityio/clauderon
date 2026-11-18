ALTER TABLE "run" DROP CONSTRAINT "run_pod_id_pod_id_fk";
--> statement-breakpoint
ALTER TABLE "run" ALTER COLUMN "pod_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "run" ADD CONSTRAINT "run_pod_id_pod_id_fk" FOREIGN KEY ("pod_id") REFERENCES "public"."pod"("id") ON DELETE set null ON UPDATE no action;