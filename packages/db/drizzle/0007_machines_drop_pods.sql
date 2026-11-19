ALTER TABLE "run" DROP CONSTRAINT "run_pod_id_pod_id_fk";
--> statement-breakpoint
DROP INDEX "run_queue_idx";--> statement-breakpoint
ALTER TABLE "run" DROP COLUMN "pod_id";--> statement-breakpoint
DROP TABLE "pod";--> statement-breakpoint
DROP TABLE "pod_host";--> statement-breakpoint
DROP TYPE "public"."pod_status";
