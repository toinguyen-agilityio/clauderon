CREATE TABLE "run_attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"run_id" uuid NOT NULL,
	"name" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"sealed" "bytea",
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "run_attachment" ADD CONSTRAINT "run_attachment_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "run_attachment_run_name_idx" ON "run_attachment" USING btree ("run_id","name");